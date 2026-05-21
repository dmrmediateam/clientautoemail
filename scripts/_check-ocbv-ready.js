'use strict';
require('dotenv').config();
const { query } = require('../src/db');
const DMR = '31114d89-ea43-434f-ae7e-9d19708ca054';

(async () => {
  const s = await query(
    'SELECT buyer_sender_email, send_from_email, send_window_start, send_window_end, timezone FROM client_settings WHERE client_id = $1',
    [DMR]
  );
  console.log('DMR team settings:', s.rows[0] || 'no settings row');

  const msgs = await query(
    "SELECT status, COUNT(*)::int FROM messages WHERE raw_payload::jsonb->>'campaign_tag' = 'ocbv_buyer_2026' GROUP BY status",
    []
  );
  console.log('OCBV message counts:', msgs.rows);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
