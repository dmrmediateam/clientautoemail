'use strict';
require('dotenv').config();
const { query } = require('../src/db');
const CLIENT_ID = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';

(async () => {
  // Show all conversations with lead_type
  const convs = await query(`
    SELECT c.id, c.lead_type, c.lead_name, c.lead_email,
           to_char(to_timestamp(c.created_at/1000), 'Mon DD') AS received,
           COUNT(m.id) FILTER (WHERE m.direction = 'outbound') AS msgs_sent
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.client_id = $1
    GROUP BY c.id, c.lead_type, c.lead_name, c.lead_email, c.created_at
    ORDER BY c.lead_type, c.created_at DESC`, [CLIENT_ID]);

  console.log('--- All Marquis leads ---');
  let lastType = null;
  for (const r of convs.rows) {
    if (r.lead_type !== lastType) {
      console.log(`\n  [${r.lead_type.toUpperCase()} leads]`);
      lastType = r.lead_type;
    }
    console.log(`    ${(r.lead_name||'?').padEnd(22)} <${r.lead_email}> received:${r.received} sent:${r.msgs_sent}`);
  }

  // Show from_email per lead type
  const senders = await query(`
    SELECT c.lead_type, m.from_email, COUNT(*)::int AS cnt
    FROM messages m JOIN conversations c ON c.id = m.conversation_id
    WHERE m.client_id = $1 AND m.direction = 'outbound' AND m.from_email IS NOT NULL
    GROUP BY c.lead_type, m.from_email
    ORDER BY c.lead_type, cnt DESC`, [CLIENT_ID]);
  console.log('\n--- Who is actually sending per lead type ---');
  senders.rows.forEach(r => console.log(` [${r.lead_type}] from:${r.from_email}  (${r.cnt} msgs)`));

  const s = await query(`
    SELECT cs.buyer_sender_email, cs.seller_sender_email,
           cs.seller_template_subject, cs.buyer_template_subject
    FROM client_settings cs WHERE cs.client_id = $1`, [CLIENT_ID]);
  console.log('\n--- Sender routing ---');
  console.log(' seller_sender_email:', s.rows[0]?.seller_sender_email || '(not set — falls back to buyer/default)');
  console.log(' buyer_sender_email: ', s.rows[0]?.buyer_sender_email  || '(not set — falls back to default)');
  console.log(' seller_template_subject:', s.rows[0]?.seller_template_subject || '(not set)');
  console.log(' buyer_template_subject: ', s.rows[0]?.buyer_template_subject  || '(not set)');

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
