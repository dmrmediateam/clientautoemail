'use strict';
require('dotenv').config();
const { query } = require('../src/db');

async function run() {
  const clientId = process.argv[2] || 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';

  const r = await query(`
    SELECT m.id, m.created_at, m.error, m.raw_payload
    FROM messages m
    WHERE m.client_id = $1
      AND m.direction = 'outbound'
      AND m.status = 'failed'
    ORDER BY m.created_at DESC
    LIMIT 3
  `, [clientId]);

  if (!r.rows.length) {
    console.log('No failed messages found.');
    process.exit(0);
  }

  r.rows.forEach((row, i) => {
    const ts = new Date(Number(row.created_at)).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    console.log(`\n=== #${i + 1} — ${ts} CT ===`);
    console.log('Error:', row.error);
    try {
      const parsed = JSON.parse(row.raw_payload || '{}');
      console.log('Raw payload keys:', Object.keys(parsed).join(', '));
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log('Raw payload (unparsed):', row.raw_payload);
    }
  });

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
