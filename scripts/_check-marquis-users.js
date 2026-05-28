'use strict';
require('dotenv').config();
const { query } = require('../src/db');

(async () => {
  const { rows } = await query(
    `SELECT email, name, google_connected,
            (google_refresh_token_encrypted IS NOT NULL) as has_refresh,
            google_scope,
            google_token_expiry
     FROM users
     WHERE client_id = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937'
     ORDER BY email`
  );
  console.log('Marquis team users:');
  rows.forEach(r => {
    const expiry = r.google_token_expiry ? new Date(Number(r.google_token_expiry)).toISOString() : 'none';
    const expired = r.google_token_expiry ? Date.now() > Number(r.google_token_expiry) : true;
    console.log(`  ${r.email} | connected: ${r.google_connected} | has_refresh: ${r.has_refresh} | token_expired: ${expired} | expiry: ${expiry}`);
  });
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
