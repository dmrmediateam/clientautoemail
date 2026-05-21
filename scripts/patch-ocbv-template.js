'use strict';
/**
 * Patch OCBV campaign messages with a hardcoded Ocean Breeze Villa email.
 * Runs UPDATE on all 69 messages that still have status='scheduled' or 'queued'
 * for campaign_tag='ocbv_buyer_2026'.
 *
 * Usage:
 *   node scripts/patch-ocbv-template.js --dry-run
 *   node scripts/patch-ocbv-template.js
 */
require('dotenv').config();
const { query } = require('../src/db');

const DRY_RUN = process.argv.includes('--dry-run');

// ── Hardcoded Ocean Breeze template ──────────────────────────────────────────
const SUBJECT = 'Following up - Ocean Breeze Villa, Turks & Caicos';

function buildBody(firstName) {
  const hi = firstName ? `Hi ${firstName},` : 'Hi there,';
  return [
    hi,
    '',
    'Thank you for your interest in Ocean Breeze Villa — I wanted to personally follow up and see if you have any questions.',
    '',
    'Ocean Breeze is a newly built 5-bedroom waterfront estate in Chalk Sound, Providenciales, offered at $6,500,000. The property sits on one of the most coveted stretches of coastline in the Caribbean and features:',
    '',
    '  • Private overwater dock, pool & rooftop terrace',
    '  • Panoramic 180° ocean views from every primary living space',
    '  • Chef\'s kitchen, wine wall, sauna & smart lighting throughout',
    '  • 6,000 sq ft interior | Built 2022',
    '  • 5 min to Sapodilla Bay Beach · 15 min to Providenciales International Airport',
    '  • 0% income, capital gains, or inheritance tax in Turks & Caicos',
    '  • 94% average rental occupancy in the Chalk Sound luxury segment',
    '',
    'I\'d love to send over the full listing package and walk you through ownership details. Are you available for a quick call this week?',
    '',
    'You can also explore the property at: https://www.oceanbreezevillatci.com/',
    '',
    'Max De Leonardis',
    'Ocean Breeze Villa',
    'max@dmrmedia.org',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('[patch] DRY RUN — no DB writes\n');

  // Fetch all OCBV messages with conversation lead_name for first_name extraction
  const { rows: msgs } = await query(`
    SELECT m.id, m.status, m.to_email, c.lead_name
    FROM   messages m
    JOIN   conversations c ON c.id = m.conversation_id
    WHERE  m.raw_payload::jsonb->>'campaign_tag' = 'ocbv_buyer_2026'
      AND  m.status IN ('scheduled', 'queued')
    ORDER  BY m.id
  `);

  console.log(`[patch] Found ${msgs.length} messages to update\n`);

  let count = 0;
  for (const msg of msgs) {
    const firstName = (msg.lead_name || '').split(/\s+/)[0] || '';
    // If the "name" looks like a username (digits, underscores, all-caps, single char), skip it
    const cleanFirst = /^[A-Za-z]{2,}$/.test(firstName) ? firstName : '';
    const subject   = SUBJECT;
    const body      = buildBody(cleanFirst);

    console.log(`  ${msg.to_email.padEnd(35)} name="${firstName || '(none)'}"`);

    if (!DRY_RUN) {
      await query(
        'UPDATE messages SET subject = $1, body = $2 WHERE id = $3',
        [subject, body, msg.id]
      );
    }
    count++;
  }

  console.log('');
  if (DRY_RUN) {
    console.log(`[patch] DRY RUN — would update ${count} messages.`);
    console.log('[patch] Run without --dry-run to apply.');
  } else {
    console.log(`[patch] Done — updated ${count} messages with Ocean Breeze template.`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
