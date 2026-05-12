'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const CLIENT_ID = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';
const SAM = 'samantha.marquis@compass.com';

async function run() {
  // 1. Add columns if they don't exist
  await query(`ALTER TABLE client_settings ADD COLUMN IF NOT EXISTS buyer_paused BOOLEAN NOT NULL DEFAULT FALSE`);
  await query(`ALTER TABLE client_settings ADD COLUMN IF NOT EXISTS seller_paused BOOLEAN NOT NULL DEFAULT FALSE`);
  console.log('Columns buyer_paused / seller_paused ensured.');

  // 2. Configure Marquis: buyer paused, seller from Sam, no CC
  await query(
    `UPDATE client_settings
     SET buyer_paused        = TRUE,
         seller_paused       = FALSE,
         seller_sender_email = $1,
         buyer_sender_email  = '',
         send_from_email     = $1,
         cc_email            = '',
         updated_at          = $2
     WHERE client_id = $3`,
    [SAM, Date.now(), CLIENT_ID]
  );
  console.log(`Marquis: buyer_paused=true, seller_sender=${SAM}, cc cleared.`);

  // 3. Delete queued buyer messages for Marquis
  const del = await query(
    `DELETE FROM messages
     WHERE client_id = $1
       AND status IN ('queued', 'rate_limited')
       AND conversation_id IN (
         SELECT id FROM conversations WHERE client_id = $1 AND lead_type = 'buyer'
       )
     RETURNING id, to_email`,
    [CLIENT_ID]
  );
  console.log(`\nDeleted ${del.rowCount} queued buyer message(s):`);
  del.rows.forEach(r => console.log(`  #${r.id} → ${r.to_email}`));

  // 4. Show current settings
  const s = await query(
    'SELECT send_from_email, seller_sender_email, buyer_sender_email, cc_email, buyer_paused, seller_paused FROM client_settings WHERE client_id = $1',
    [CLIENT_ID]
  );
  console.log('\nCurrent settings:', s.rows[0]);

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
