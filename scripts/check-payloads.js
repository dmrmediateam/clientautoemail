'use strict';
require('dotenv').config();
const { query } = require('../src/db');
async function run() {
  const r = await query(
    'SELECT raw_payload FROM messages WHERE raw_payload IS NOT NULL ORDER BY created_at DESC LIMIT 3'
  );
  r.rows.forEach((row, i) => {
    console.log(`\n--- Payload ${i + 1} ---`);
    try { console.log(JSON.stringify(JSON.parse(row.raw_payload), null, 2)); }
    catch { console.log(row.raw_payload); }
  });
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
