'use strict';
require('dotenv').config();
const { query } = require('../src/db');

// Sets send_from_email for a client — run once to configure the designated sender
async function run() {
  const clientId = process.argv[2];
  const email = process.argv[3];
  if (!clientId || !email) {
    console.error('Usage: node scripts/set-sender.js <client_id> <email>');
    process.exit(1);
  }
  const ts = Date.now();
  await query(
    `UPDATE client_settings SET send_from_email = LOWER($1), updated_at = $2 WHERE client_id = $3`,
    [email, ts, clientId]
  );
  const r = await query('SELECT send_from_email FROM client_settings WHERE client_id = $1', [clientId]);
  console.log('send_from_email set to:', r.rows[0]?.send_from_email);
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
