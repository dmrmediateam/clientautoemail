'use strict';
/**
 * Backfill script: re-normalize all LP webhook messages that stored
 * unknown+timestamp@unknown.invalid conversations.
 *
 * Usage: node scripts/backfill-lp-leads.js [--dry-run]
 */
require('dotenv').config();
const { query } = require('../src/db');
const { normalize } = require('../src/services/leadNormalizer');

const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('[backfill] DRY RUN — no changes will be saved\n');

async function main() {
  // Find all messages that have an LP-format raw_payload (eventName = "leads")
  // whose conversation has an unknown email
  const { rows: msgs } = await query(`
    SELECT m.id        AS msg_id,
           m.raw_payload,
           m.subject,
           m.error,
           c.id        AS conv_id,
           c.client_id,
           c.lead_email,
           c.lead_name,
           c.lead_type
    FROM   messages m
    JOIN   conversations c ON c.id = m.conversation_id
    WHERE  c.lead_email LIKE 'unknown+%@unknown.invalid'
      AND  m.raw_payload IS NOT NULL
    ORDER  BY m.created_at ASC
  `);

  console.log(`Found ${msgs.length} message(s) to backfill.\n`);
  if (msgs.length === 0) { process.exit(0); }

  const seenConvs = new Set();

  for (const msg of msgs) {
    let raw;
    try {
      raw = typeof msg.raw_payload === 'string' ? JSON.parse(msg.raw_payload) : msg.raw_payload;
    } catch {
      console.log(`[skip] msg=${msg.msg_id} — invalid JSON in raw_payload`);
      continue;
    }

    const lead = normalize(raw);

    if (!lead.email) {
      console.log(`[skip] msg=${msg.msg_id} conv=${msg.conv_id} — still no email after re-normalize`);
      console.log(`       raw keys: ${Object.keys(raw).join(', ')}`);
      if (raw.data) console.log(`       data.leadEmail: ${raw.data.leadEmail}`);
      continue;
    }

    console.log(`[fix] conv=${msg.conv_id}`);
    console.log(`      email:    ${msg.lead_email} → ${lead.email}`);
    console.log(`      name:     ${msg.lead_name || '(none)'} → ${lead.full_name || '(none)'}`);
    console.log(`      type:     ${msg.lead_type} → ${lead.lead_type}`);
    console.log(`      property: ${lead.property_address || '(none)'}`);
    console.log(`      source:   ${lead.source}`);

    if (DRY_RUN) continue;

    // Update conversation (only once per conversation even if multiple messages)
    if (!seenConvs.has(msg.conv_id)) {
      seenConvs.add(msg.conv_id);

      // Check if a conversation already exists with this lead_email for this client
      // (avoid creating a duplicate — if one exists, we merge by updating the unknown one)
      const { rows: existing } = await query(
        `SELECT id FROM conversations WHERE client_id = $1 AND lead_email = $2 AND id != $3 LIMIT 1`,
        [msg.client_id, lead.email, msg.conv_id]
      );

      if (existing.length) {
        console.log(`      [WARN] Conversation ${existing[0].id} already exists for ${lead.email} — skipping update`);
        continue;
      }

      await query(
        `UPDATE conversations
         SET lead_email       = $1,
             lead_name        = COALESCE(NULLIF($2, ''), lead_name),
             lead_phone       = COALESCE(NULLIF($3, ''), lead_phone),
             lead_type        = $4,
             property_address = COALESCE(NULLIF($5, ''), property_address),
             source           = COALESCE(NULLIF($6, ''), source)
         WHERE id = $7`,
        [
          lead.email,
          lead.full_name || '',
          lead.phone || '',
          lead.lead_type,
          lead.property_address || '',
          lead.source || '',
          msg.conv_id,
        ]
      );

      // Also update the message to_email and status
      await query(
        `UPDATE messages
         SET to_email = $1,
             status   = CASE WHEN status = 'failed' AND error = 'No lead email in payload'
                             THEN 'pending' ELSE status END,
             error    = CASE WHEN error = 'No lead email in payload' THEN NULL ELSE error END
         WHERE conversation_id = $2 AND direction = 'outbound'`,
        [lead.email, msg.conv_id]
      );
    }
  }

  console.log(`\n[backfill] Done. ${DRY_RUN ? '(dry run)' : `Updated ${seenConvs.size} conversation(s).`}`);
  process.exit(0);
}

main().catch(e => { console.error('[backfill] Error:', e.message); process.exit(1); });
