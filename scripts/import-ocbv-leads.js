'use strict';
/**
 * Step 1 — Import: Ocean Breeze Villa TCI buyer outreach
 *
 * Reads the lead CSV and creates one SCHEDULED (not yet queued) outbound
 * message per lead for the DMR Media Team client.  Status = 'scheduled'
 * means the cron completely ignores these messages — nothing is sent until
 * you explicitly run activate-ocbv-campaign.js (Step 2).
 *
 * Usage:
 *   node scripts/import-ocbv-leads.js --dry-run   # preview without DB writes
 *   node scripts/import-ocbv-leads.js             # import for real
 */
require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const { query }           = require('../src/db');
const clientsRepo         = require('../src/repos/clients');
const conversationsRepo   = require('../src/repos/conversations');
const messagesRepo        = require('../src/repos/messages');
const tpl                 = require('../src/services/template');

const DRY_RUN  = process.argv.includes('--dry-run');
const CSV_PATH = path.resolve(__dirname, '../Lead form report (2).csv');

// Tag used by activate-ocbv-campaign.js to find these messages
const CAMPAIGN_TAG = 'ocbv_buyer_2026';

// ── Minimal CSV parser (handles quoted fields) ────────────────────────────────

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
  if (!lines.length) return [];

  function splitRow(row) {
    const fields = [];
    let cur = '', inQ = false;
    for (const ch of row) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { fields.push(cur); cur = ''; continue; }
      cur += ch;
    }
    fields.push(cur);
    return fields;
  }

  const headers = splitRow(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = splitRow(line);
    const obj  = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
    return obj;
  }).filter(r => r['Email'] && r['Email'].includes('@'));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('[import] DRY RUN — no DB writes\n');

  // Load client
  const { rows: clientRows } = await query(
    `SELECT id FROM clients WHERE LOWER(agent_email) = LOWER('team@dmrmedia.org') LIMIT 1`
  );
  if (!clientRows[0]) {
    console.error('ERROR: DMR Media Team client not found (agent_email = team@dmrmedia.org)');
    process.exit(1);
  }
  const client = await clientsRepo.findById(clientRows[0].id);
  if (!client) { console.error('ERROR: Could not load client settings'); process.exit(1); }

  console.log(`[import] Client   : ${client.name} (${client.id})`);
  console.log(`[import] Campaign : ${CAMPAIGN_TAG}`);
  console.log(`[import] Status   : scheduled  (cron will NOT send until activated)`);

  // Parse CSV
  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const rows    = parseCSV(csvText);

  // Deduplicate by email (keep first occurrence)
  const seen  = new Set();
  const leads = rows.filter(r => {
    const key = r['Email'].toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`[import] Leads    : ${leads.length} unique (${rows.length - leads.length} dupes skipped)\n`);

  // Template + sender
  const template  = client.templates.buyer;
  const fromEmail =
    client.settings.buyer_sender_email ||
    client.settings.send_from_email    ||
    client.google.email                ||
    client.agent_email;

  console.log(`[import] Template subject : ${template.subject}`);
  console.log(`[import] Sender           : ${fromEmail}`);
  console.log('');

  let imported = 0;

  for (let i = 0; i < leads.length; i++) {
    const row  = leads[i];
    const name = (row['Full name'] || '').trim();

    const nameParts = name.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.slice(1).join(' ') || '';

    const leadData = {
      full_name:        name,
      first_name:       firstName,
      last_name:        lastName,
      email:            row['Email'],
      phone:            row['Phone number'] || '',
      lead_type:        'buyer',
      source:           row['Campaign name'] || 'Google Ads',
      property_address: '',
    };

    const renderData = {
      ...leadData,
      agent_name:    client.agent_name,
      agent_email:   client.agent_email,
      agent_phone:   client.agent_phone || '',
      client_name:   client.name,
      client_website: client.website || '',
    };

    const subject = tpl.render(template.subject, renderData);
    const body    = tpl.render(template.body,    renderData);

    console.log(`  [${String(i + 1).padStart(2)}] ${name.padEnd(30)} <${row['Email']}>`);

    if (DRY_RUN) continue;

    const conversation = await conversationsRepo.findOrCreateForLead({
      client_id:        client.id,
      lead_email:       leadData.email,
      lead_name:        leadData.full_name,
      lead_phone:       leadData.phone,
      lead_type:        leadData.lead_type,
      property_address: leadData.property_address,
      source:           leadData.source,
      thread_id:        null,
    });

    await messagesRepo.create({
      conversation_id: conversation.id,
      client_id:       client.id,
      direction:       'outbound',
      from_email:      fromEmail,
      to_email:        leadData.email,
      subject,
      body,
      status:          'scheduled',   // cron ignores — activate script promotes to queued
      scheduled_for:   null,           // assigned by activate-ocbv-campaign.js
      raw_payload:     {
        campaign_tag:  CAMPAIGN_TAG,
        source:        'csv_import',
        csv_campaign:  row['Campaign name'] || '',
        original_row:  row,
      },
    });

    imported++;
  }

  console.log('');
  if (DRY_RUN) {
    console.log(`[import] DRY RUN complete — would import ${leads.length} messages (status=scheduled, cron-safe).`);
    console.log('[import] Run without --dry-run to commit, then activate-ocbv-campaign.js when ready.');
  } else {
    console.log(`[import] Done. Imported ${imported} messages with status=scheduled.`);
    console.log('[import] Next: node scripts/activate-ocbv-campaign.js --dry-run');
  }
  process.exit(0);
}

main().catch(e => { console.error('[import] FATAL:', e.message); process.exit(1); });
