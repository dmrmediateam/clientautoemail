'use strict';
require('dotenv').config();
const { query } = require('../src/db');

async function main() {
  const clientId = process.argv[2] || 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';
  const r = await query(
    `SELECT id, raw_payload, normalized_payload, status, error, created_at
     FROM leads
     WHERE client_id = $1
     ORDER BY created_at DESC
     LIMIT 6`,
    [clientId]
  );
  r.rows.forEach(row => {
    console.log(`--- Lead ${row.id}  ${new Date(Number(row.created_at)).toISOString()}  status: ${row.status}`);
    if (row.error) console.log('ERROR:', row.error);
    try { console.log('RAW:', JSON.stringify(JSON.parse(row.raw_payload), null, 2)); } catch { console.log('RAW:', row.raw_payload); }
    try { console.log('NORM:', JSON.stringify(JSON.parse(row.normalized_payload), null, 2)); } catch {}
    console.log('');
  });
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
