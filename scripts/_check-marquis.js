'use strict';
require('dotenv').config();
const { query } = require('../src/db');

async function run() {
  const CLIENT_ID = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';

  const u = await query(
    'SELECT email, name, role, (google_refresh_token_encrypted IS NOT NULL) as connected FROM users WHERE client_id = $1',
    [CLIENT_ID]
  );
  console.log('=== Marquis Team ===');
  u.rows.forEach(r => console.log(r));

  const sc = await query(
    'SELECT email, google_scope FROM users WHERE client_id = $1',
    [CLIENT_ID]
  );
  console.log('\n=== User Scopes ===');
  sc.rows.forEach(r => console.log(`${r.email}: ${r.google_scope || '(none)'}`));

  const s = await query(
    'SELECT send_from_email, buyer_sender_email, seller_sender_email, cc_email FROM client_settings WHERE client_id = $1',
    [CLIENT_ID]
  );
  console.log('\n=== Send Settings ===');
  console.log(s.rows[0]);

  const m = await query(
    "SELECT id, to_email, status, SUBSTRING(error, 1, 80) as error FROM messages WHERE client_id = $1 AND status = 'failed' ORDER BY id DESC LIMIT 7",
    [CLIENT_ID]
  );
  console.log('\n=== Recent Failed Messages ===');
  m.rows.forEach(r => console.log(r));

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
