'use strict';
require('dotenv').config();
const { query } = require('../src/db');

async function main() {
  const ts = Date.now();
  const r = await query(
    `UPDATE messages
     SET scheduled_for = $1
     WHERE status IN ('queued','rate_limited')
       AND client_id = $2
     RETURNING id, to_email`,
    [ts, 'dfa8056c-38c9-4903-ae37-37d1a2015910']
  );
  console.log('Updated:', r.rows);
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
