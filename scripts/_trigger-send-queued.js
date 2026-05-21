'use strict';
/**
 * Manually triggers the send-queued cron logic — sends all messages currently due.
 * Use this until the Vercel cron Authorization Bearer fix is deployed.
 */
require('dotenv').config();
const clientsRepo    = require('../src/repos/clients');
const conversationsRepo = require('../src/repos/conversations');
const messagesRepo   = require('../src/repos/messages');
const google         = require('../src/services/google');

const SYSTEM_BCC = { email: 'team@dmrmedia.org' };

(async () => {
  const due = await messagesRepo.dueQueued(100);
  console.log(`Messages due: ${due.length}`);
  if (!due.length) { console.log('Nothing to send.'); process.exit(0); }

  let sent = 0, failed = 0;

  for (const msg of due) {
    try {
      const [conv, client] = await Promise.all([
        conversationsRepo.findById(msg.conversation_id),
        clientsRepo.findById(msg.client_id),
      ]);

      if (!conv || !client?.google?.connected) {
        await messagesRepo.markFailed(msg.id, 'Conversation/client unavailable for send');
        failed++;
        console.log(`  SKIP id=${msg.id} to=${msg.to_email} — no conv/client`);
        continue;
      }

      const leadType = conv.lead_type || 'buyer';
      const perTypeSender = leadType === 'seller'
        ? (client.settings?.seller_sender_email || '')
        : (client.settings?.buyer_sender_email || '');
      const sendFromEmail = perTypeSender || client.settings?.send_from_email || '';
      const ccEmail = client.settings?.cc_email || '';

      let result;
      if (sendFromEmail) {
        const teamUsers = await clientsRepo.listUsersForClient(client.id);
        const senderUser = teamUsers.find(u => u.email.toLowerCase() === sendFromEmail.toLowerCase() && u.connected);
        if (senderUser) {
          result = await google.sendAsUserRow(senderUser, senderUser.name || client.agent_name, {
            to: { email: msg.to_email, name: conv.lead_name || '' },
            cc: ccEmail ? { email: ccEmail } : null,
            bcc: SYSTEM_BCC,
            subject: msg.subject,
            body: msg.body,
            threadId: conv.thread_id || msg.gmail_thread_id || undefined,
          });
        } else {
          result = await google.sendAsClient(client, {
            to: { email: msg.to_email, name: conv.lead_name || '' },
            cc: ccEmail ? { email: ccEmail } : null,
            bcc: SYSTEM_BCC,
            subject: msg.subject,
            body: msg.body,
          });
        }
      } else {
        result = await google.sendAsClient(client, {
          to: { email: msg.to_email, name: conv.lead_name || '' },
          cc: ccEmail ? { email: ccEmail } : null,
          bcc: SYSTEM_BCC,
          subject: msg.subject,
          body: msg.body,
        });
      }

      await messagesRepo.markSent(msg.id, {
        gmail_message_id: result.messageId,
        gmail_thread_id: result.threadId,
      });
      if (result.threadId) {
        await conversationsRepo.updateThreadId(conv.id, result.threadId);
      }
      sent++;
      console.log(`  SENT id=${msg.id} to=${msg.to_email} (${result.messageId})`);

    } catch (err) {
      await messagesRepo.markFailed(msg.id, err.code ? `${err.code}: ${err.message}` : String(err.message || err));
      failed++;
      console.log(`  FAIL id=${msg.id} to=${msg.to_email} — ${err.message}`);
    }
  }

  console.log(`\nDone: sent=${sent} failed=${failed} total=${due.length}`);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
