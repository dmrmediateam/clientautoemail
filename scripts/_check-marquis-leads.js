'use strict';
require('dotenv').config();
const { query } = require('../src/db');

(async () => {
  const { rows: convs } = await query(`
    SELECT c.lead_name, c.lead_email, c.lead_type, c.created_at,
           m.status, m.error, m.sent_at
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.client_id = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937'
    ORDER BY c.created_at DESC LIMIT 20
  `);
  console.log('Marquis conversations (' + convs.length + '):');
  if (!convs.length) console.log('  (none)');
  convs.forEach(r => console.log(
    ' ', r.lead_name, '|', r.lead_email,
    '| type:', r.lead_type,
    '| msg_status:', r.status,
    '| sent:', r.sent_at ? new Date(Number(r.sent_at)).toISOString() : 'N/A',
    r.error ? '| ERR: ' + r.error : ''
  ));

  const { rows: clients } = await query(`
    SELECT c.id, c.name, c.active,
           (c.google_access_token_encrypted IS NOT NULL) as has_token,
           c.google_email,
           cs.send_from_email, cs.buyer_sender_email, cs.seller_sender_email
    FROM clients c
    LEFT JOIN client_settings cs ON cs.client_id = c.id
    ORDER BY c.created_at
  `);
  console.log('\nAll clients:');
  clients.forEach(r => console.log(
    ' ', r.name,
    '| active:', r.active,
    '| google:', r.google_email || '(none)',
    '| has_token:', r.has_token,
    '| send_from:', r.send_from_email || r.buyer_sender_email || '(default)'
  ));

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
