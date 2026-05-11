'use strict';
require('dotenv').config();
const { query } = require('../src/db');

async function main() {
  const clientId = process.argv[2] || 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';

  // Get conversations with messages for this client
  const convs = await query(
    `SELECT c.id, c.lead_email, c.lead_name, c.lead_phone, c.lead_type,
            c.property_address, c.source, c.status, c.created_at,
            COUNT(m.id) as msg_count
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE c.client_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC
     LIMIT 8`,
    [clientId]
  );

  console.log(`\n=== Conversations for ${clientId} ===\n`);
  for (const conv of convs.rows) {
    console.log(`Conversation ${conv.id}`);
    console.log(`  email:    ${conv.lead_email}`);
    console.log(`  name:     ${conv.lead_name}`);
    console.log(`  phone:    ${conv.lead_phone}`);
    console.log(`  type:     ${conv.lead_type}`);
    console.log(`  property: ${conv.property_address}`);
    console.log(`  source:   ${conv.source}`);
    console.log(`  msgs:     ${conv.msg_count}`);
    console.log(`  when:     ${new Date(Number(conv.created_at)).toISOString()}`);

    // Get the raw message payload for first message
    const msgs = await query(
      `SELECT direction, status, error, raw_payload, subject, from_email, to_email, created_at
       FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 2`,
      [conv.id]
    );
    msgs.rows.forEach(m => {
      console.log(`  [msg] dir=${m.direction} status=${m.status} subject="${m.subject}"`);
      if (m.error) console.log(`        error: ${m.error}`);
      if (m.raw_payload) {
        try {
          const p = JSON.parse(m.raw_payload);
          console.log(`        raw_payload keys: ${Object.keys(p).join(', ')}`);
          console.log(`        raw_payload: ${JSON.stringify(p, null, 2).slice(0, 800)}`);
        } catch { console.log(`        raw_payload: ${String(m.raw_payload).slice(0, 400)}`); }
      }
    });
    console.log('');
  }
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
