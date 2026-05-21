'use strict';
require('dotenv').config();
const { query } = require('../src/db');
const CLIENT_ID = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';

(async () => {
  const convs = await query(
    'SELECT lead_type, COUNT(*)::int AS cnt FROM conversations WHERE client_id = $1 GROUP BY lead_type',
    [CLIENT_ID]
  );
  console.log('--- Leads by type ---');
  if (!convs.rows.length) console.log('  (none)');
  convs.rows.forEach(r => console.log(' ', r.lead_type, r.cnt));

  const msgs = await query(
    'SELECT status, COUNT(*)::int AS cnt FROM messages WHERE client_id = $1 GROUP BY status',
    [CLIENT_ID]
  );
  console.log('\n--- Messages by status ---');
  msgs.rows.forEach(r => console.log(' ', r.status, r.cnt));

  const recent = await query(
    `SELECT m.to_email, m.subject, m.status, m.sent_at, c2.lead_name
     FROM messages m
     JOIN conversations c2 ON c2.id = m.conversation_id
     WHERE m.client_id = $1 AND m.direction = 'outbound'
     ORDER BY COALESCE(m.sent_at, m.created_at) DESC LIMIT 8`,
    [CLIENT_ID]
  );
  console.log('\n--- Last 8 outbound ---');
  recent.rows.forEach(r => {
    const when = r.sent_at
      ? new Date(r.sent_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'not sent';
    console.log(` [${r.status}] ${(r.lead_name || '').padEnd(22)} <${r.to_email}> ${when}`);
  });

  const replies = await query(
    `SELECT m.from_email, c2.lead_name, m.created_at
     FROM messages m
     JOIN conversations c2 ON c2.id = m.conversation_id
     WHERE m.client_id = $1 AND m.direction = 'inbound'
     ORDER BY m.created_at DESC LIMIT 5`,
    [CLIENT_ID]
  );
  console.log('\n--- Inbound replies ---');
  if (!replies.rows.length) console.log('  (none yet)');
  replies.rows.forEach(r => {
    const when = new Date(r.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    console.log(` ${(r.lead_name || '').padEnd(22)} <${r.from_email}> ${when}`);
  });

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
