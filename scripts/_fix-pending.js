'use strict';
require('dotenv').config();
const { query } = require('../src/db');

async function main() {
  const r = await query(
    `UPDATE messages
     SET status = 'queued', error = NULL
     WHERE status = 'pending' AND direction = 'outbound'
     RETURNING id, to_email, status`
  );
  console.log(`Updated ${r.rowCount} message(s) to queued:`);
  r.rows.forEach(m => console.log(' ', m.id, m.to_email, '->', m.status));
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
