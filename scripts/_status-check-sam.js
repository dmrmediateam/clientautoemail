'use strict';
require('dotenv').config();
const { query } = require('../src/db');
const CLIENT_ID = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';

(async () => {
  const users = await query(`
    SELECT email, google_connected,
           CASE WHEN google_refresh_token_encrypted IS NOT NULL THEN 'yes' ELSE 'no' END AS has_token,
           google_token_expiry
    FROM users WHERE client_id = $1 ORDER BY email`, [CLIENT_ID]);
  console.log('--- Team token status ---');
  users.rows.forEach(r =>
    console.log(' ', r.email, '| connected:', r.google_connected, '| has_token:', r.has_token, '| expiry:', r.google_token_expiry ? new Date(Number(r.google_token_expiry)).toLocaleString() : 'n/a')
  );

  const msgs = await query(`
    SELECT m.id, m.status, m.from_email, m.to_email, c.lead_type, c.lead_name,
           to_char(to_timestamp(m.sent_at/1000), 'Mon DD HH12:MI AM') AS sent_fmt,
           to_char(to_timestamp(m.created_at/1000), 'Mon DD HH12:MI AM') AS created_fmt
    FROM messages m JOIN conversations c ON c.id = m.conversation_id
    WHERE m.client_id = $1 AND m.direction = 'outbound'
    ORDER BY COALESCE(m.sent_at, m.created_at) DESC LIMIT 10`, [CLIENT_ID]);
  console.log('\n--- Last 10 outbound messages ---');
  msgs.rows.forEach(r =>
    console.log(` [${r.status}] msg${r.id} [${r.lead_type}] ${(r.lead_name||'').padEnd(20)} from:${r.from_email||'?'} sent:${r.sent_fmt||'?'} created:${r.created_fmt}`)
  );

  const c = await query('SELECT name, send_from_email, agent_name FROM clients WHERE id = $1', [CLIENT_ID]);
  console.log('\n--- Client record ---');
  console.log(' name:', c.rows[0]?.name, '| send_from_email:', c.rows[0]?.send_from_email, '| agent_name:', c.rows[0]?.agent_name);

  const s = await query('SELECT buyer_sender_email, seller_sender_email FROM client_settings WHERE client_id = $1', [CLIENT_ID]);
  console.log('\n--- Client settings ---');
  console.log(' buyer_sender:', s.rows[0]?.buyer_sender_email || '(not set)');
  console.log(' seller_sender:', s.rows[0]?.seller_sender_email || '(not set)');

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
