'use strict';
/**
 * Promote samanthamarquishomes@gmail.com as the primary sender for Marquis.
 *
 * What this does:
 *  1. Shows current state of both Sam accounts
 *  2. Resets google_connected = FALSE on samanthamarquishomes@gmail.com
 *     (token is NULL so showing "connected" was misleading — dashboard will
 *      now correctly show "Needs reconnect" so Sam knows to go to /onboarding)
 *  3. Sets buyer_sender_email AND seller_sender_email to samanthamarquishomes@gmail.com
 *     for the Marquis client
 *
 * After running this:
 *  → Sam opens https://leads.dmrmedia.org/onboarding and signs in with samanthamarquishomes@gmail.com
 *  → Token is saved, google_connected flips to TRUE automatically
 *  → Both buyer and seller leads now route through her personal Gmail
 */

require('dotenv').config();
const { query } = require('../src/db');

const CLIENT_ID    = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937'; // Marquis
const SAM_GMAIL    = 'samanthamarquishomes@gmail.com';
const SAM_COMPASS  = 'samantha.marquis@compass.com';

(async () => {
  // ── 1. Current state ─────────────────────────────────────────────────────
  console.log('=== CURRENT STATE ===\n');

  const users = await query(
    `SELECT email, role, google_connected,
            CASE WHEN google_refresh_token_encrypted IS NOT NULL THEN 'yes' ELSE 'NO' END AS has_token,
            google_token_expiry
     FROM users
     WHERE email IN ($1, $2)`,
    [SAM_GMAIL, SAM_COMPASS]
  );
  users.rows.forEach(u => {
    const exp = u.google_token_expiry
      ? new Date(Number(u.google_token_expiry)).toLocaleString('en-US', { timeZone: 'America/Chicago' })
      : 'n/a';
    console.log(`  ${u.email}`);
    console.log(`    role=${u.role}  connected=${u.google_connected}  has_token=${u.has_token}  expiry=${exp}`);
  });

  const settings = await query(
    'SELECT buyer_sender_email, seller_sender_email, send_from_email FROM client_settings WHERE client_id = $1',
    [CLIENT_ID]
  );
  const s = settings.rows[0] || {};
  console.log(`\n  buyer_sender_email  = "${s.buyer_sender_email || '(empty)'}"`);
  console.log(`  seller_sender_email = "${s.seller_sender_email || '(empty)'}"`);
  console.log(`  send_from_email     = "${s.send_from_email || '(empty)'}"`);;

  // ── 2. Reset google_connected on the gmail account (no token = not connected) ─
  console.log(`\n=== FIXING: setting google_connected = false on ${SAM_GMAIL} ===`);
  await query(
    `UPDATE users SET google_connected = false, updated_at = $2 WHERE email = $1`,
    [SAM_GMAIL, Date.now()]
  );
  console.log('  Done. Dashboard will now show "Needs reconnect" for this account.');

  // ── 3. Set both senders to samanthamarquishomes@gmail.com ─────────────────
  console.log(`\n=== UPDATING Marquis sender routing ===`);
  await query(
    `UPDATE client_settings
     SET buyer_sender_email  = $2,
         seller_sender_email = $3,
         updated_at          = $4
     WHERE client_id = $1`,
    [CLIENT_ID, SAM_GMAIL, SAM_GMAIL, Date.now()]
  );
  console.log(`  buyer_sender_email  → ${SAM_GMAIL}`);
  console.log(`  seller_sender_email → ${SAM_GMAIL}`);

  // ── 4. Verify ─────────────────────────────────────────────────────────────
  console.log('\n=== VERIFIED NEW STATE ===\n');
  const check = await query(
    'SELECT buyer_sender_email, seller_sender_email FROM client_settings WHERE client_id = $1',
    [CLIENT_ID]
  );
  console.log('  buyer_sender_email  =', check.rows[0]?.buyer_sender_email);
  console.log('  seller_sender_email =', check.rows[0]?.seller_sender_email);

  const samRow = await query(
    `SELECT email, google_connected,
            CASE WHEN google_refresh_token_encrypted IS NOT NULL THEN 'yes' ELSE 'NO' END AS has_token
     FROM users WHERE email = $1`,
    [SAM_GMAIL]
  );
  console.log('\n  samanthamarquishomes@gmail.com:');
  console.log(`    connected=${samRow.rows[0]?.google_connected}  has_token=${samRow.rows[0]?.has_token}`);

  console.log(`
=== NEXT STEP ===

Sam must reconnect her account:
  1. Open: https://leads.dmrmedia.org/onboarding
  2. Click "Sign in with Google"
  3. Sign in with: ${SAM_GMAIL}
  4. Approve the gmail.send permission

After that, her token will be saved and all Marquis leads
(both buyer AND seller) will send from her personal Gmail.

Samantha's compass account (${SAM_COMPASS}) will remain
on the team as a backup — she just won't be the designated sender.
`);

  process.exit(0);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
