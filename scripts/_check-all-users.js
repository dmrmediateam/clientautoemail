'use strict';
require('dotenv').config();
const { query } = require('../src/db');
async function run() {
  const r = await query(
    `SELECT id, email, name, google_connected, google_refresh_token_encrypted IS NOT NULL as has_token, google_scope
     FROM users ORDER BY created_at`
  );
  r.rows.forEach(u => console.log(JSON.stringify({
    email: u.email, name: u.name, connected: u.google_connected, has_token: u.has_token,
    gmail: (u.google_scope||'').includes('gmail')
  })));
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
