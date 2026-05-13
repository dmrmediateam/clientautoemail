'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const CLIENT_ID = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';

async function run() {
  const r = await query(
    `UPDATE users
     SET google_access_token_encrypted  = NULL,
         google_refresh_token_encrypted = NULL,
         google_token_expiry            = NULL,
         google_scope                   = NULL,
         updated_at                     = $1
     WHERE client_id = $2
     RETURNING email`,
    [Date.now(), CLIENT_ID]
  );
  console.log(`Cleared tokens for ${r.rowCount} user(s):`);
  r.rows.forEach(u => console.log(`  ${u.email}`));
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
