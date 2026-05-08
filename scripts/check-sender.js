'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const MAX_CLIENT = 'dfa8056c-38c9-4903-ae37-37d1a2015910';

async function run() {
  const [u, s] = await Promise.all([
    query(
      'SELECT email, role, google_connected, (google_refresh_token_encrypted IS NOT NULL) AS has_token FROM users WHERE client_id = $1 ORDER BY role DESC',
      [MAX_CLIENT]
    ),
    query('SELECT send_from_email, cc_email FROM client_settings WHERE client_id = $1', [MAX_CLIENT]),
  ]);
  console.log('USERS:', JSON.stringify(u.rows, null, 2));
  console.log('SETTINGS:', JSON.stringify(s.rows, null, 2));
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
