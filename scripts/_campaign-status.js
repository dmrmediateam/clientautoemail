'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const CLIENT = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';

async function run() {
  const s = await query(
    `SELECT send_from_email, seller_sender_email, buyer_sender_email,
            cc_email, buyer_paused, seller_paused, send_window_start, send_window_end, timezone
     FROM client_settings WHERE client_id = $1`,
    [CLIENT]
  );
  const cfg = s.rows[0];

  console.log('\n=== Marquis Farwell Homes — Campaign Status ===');
  console.log('');
  console.log('SELLER: ' + (cfg.seller_paused ? 'PAUSED' : 'ON (active)'));
  console.log('  sender: ' + (cfg.seller_sender_email || cfg.send_from_email));
  console.log('  cc:     ' + (cfg.cc_email || '(none)'));
  console.log('  window: ' + cfg.send_window_start + ' - ' + cfg.send_window_end + ' ' + cfg.timezone);
  console.log('');
  console.log('BUYER:  ' + (cfg.buyer_paused ? 'PAUSED (blocked)' : 'ON'));
  console.log('  sender: ' + (cfg.buyer_sender_email || cfg.send_from_email || '(none)'));

  const users = await query(
    `SELECT email, google_scope, google_refresh_token_encrypted IS NOT NULL as connected
     FROM users WHERE client_id = $1 ORDER BY created_at`,
    [CLIENT]
  );
  console.log('\nTeam users:');
  users.rows.forEach(u => {
    const hasGmail = (u.google_scope || '').includes('gmail');
    console.log('  ' + (u.connected ? '[connected]' : '[no token] ') + ' ' + u.email + (hasGmail ? ' (gmail.send OK)' : ' (NO gmail scope)'));
  });

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
