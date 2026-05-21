'use strict';
/**
 * Force-sends a specific stuck queued message by ID.
 * Usage: node scripts/_force-send-msg.js <message_id>
 */
require('dotenv').config();
const { query } = require('../src/db');
const clientsRepo = require('../src/repos/clients');
const conversationsRepo = require('../src/repos/conversations');
const messagesRepo = require('../src/repos/messages');
const google = require('../src/services/google');

const MSG_ID = Number(process.argv[2]);
if (!MSG_ID) { console.error('Usage: node scripts/_force-send-msg.js <message_id>'); process.exit(1); }

(async () => {
  const { rows } = await query('SELECT * FROM messages WHERE id = $1', [MSG_ID]);
  const raw = rows[0];
  if (!raw) { console.error('Message not found:', MSG_ID); process.exit(1); }
  console.log(`Message: id=${raw.id} status=${raw.status} to=${raw.to_email}`);

  const [conv, client] = await Promise.all([
    conversationsRepo.findById(raw.conversation_id),
    clientsRepo.findById(raw.client_id),
  ]);

  const leadType = conv.lead_type || 'buyer';
  const perTypeSender = leadType === 'seller'
    ? (client.settings?.seller_sender_email || '')
    : (client.settings?.buyer_sender_email || '');
  const sendFromEmail = perTypeSender || client.settings?.send_from_email || '';

  console.log(`Sender resolved to: ${sendFromEmail || '(client oauth)'}`);

  const SYSTEM_BCC = { email: 'team@dmrmedia.org' };
  const ccEmail = client.settings?.cc_email || '';

  let result;
  if (sendFromEmail) {
    const teamUsers = await clientsRepo.listUsersForClient(client.id);
    const senderUser = teamUsers.find(u => u.email.toLowerCase() === sendFromEmail.toLowerCase() && u.connected);
    if (!senderUser) throw new Error(`Sender ${sendFromEmail} not found or not connected`);
    result = await google.sendAsUserRow(senderUser, senderUser.name || client.agent_name, {
      to: { email: raw.to_email, name: conv.lead_name || '' },
      cc: ccEmail ? { email: ccEmail } : null,
      bcc: SYSTEM_BCC,
      subject: raw.subject,
      body: raw.body,
      threadId: conv.thread_id || raw.gmail_thread_id || undefined,
    });
  } else {
    result = await google.sendAsClient(client, {
      to: { email: raw.to_email, name: conv.lead_name || '' },
      cc: ccEmail ? { email: ccEmail } : null,
      bcc: SYSTEM_BCC,
      subject: raw.subject,
      body: raw.body,
    });
  }

  await messagesRepo.markSent(raw.id, {
    gmail_message_id: result.messageId,
    gmail_thread_id: result.threadId,
  });

  console.log(`Sent! Gmail message ID: ${result.messageId}`);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
