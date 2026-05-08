'use strict';

const express = require('express');
const messagesRepo = require('../repos/messages');
const conversationsRepo = require('../repos/conversations');
const clientsRepo = require('../repos/clients');
const google = require('../services/google');

const router = express.Router();

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return true;
  return req.headers['x-cron-secret'] === secret || req.query.secret === secret;
}

router.post('/send-queued', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const due = await messagesRepo.dueQueued(100);
  const out = { total: due.length, sent: 0, failed: 0 };
  for (const msg of due) {
    try {
      const [conv, client] = await Promise.all([
        conversationsRepo.findById(msg.conversation_id),
        clientsRepo.findById(msg.client_id),
      ]);
      if (!conv || !client?.google?.connected) {
        await messagesRepo.markFailed(msg.id, 'Conversation/client unavailable for send');
        out.failed += 1;
        continue;
      }
      const ccEmail = client.settings?.cc_email || '';
      const sendFromEmail = client.settings?.send_from_email || '';

      let result;
      if (sendFromEmail) {
        // Use the designated sender's per-user tokens
        const teamUsers = await clientsRepo.listUsersForClient(client.id);
        const senderUser = teamUsers.find(u => u.email.toLowerCase() === sendFromEmail.toLowerCase() && u.connected);
        if (senderUser) {
          result = await google.sendAsUserRow(senderUser, client.agent_name, {
            to: { email: msg.to_email, name: conv.lead_name || '' },
            cc: ccEmail ? { email: ccEmail } : null,
            subject: msg.subject,
            body: msg.body,
            threadId: conv.thread_id || msg.gmail_thread_id || undefined,
          });
        } else {
          // Designated sender not connected — fall back to client-level tokens
          result = await google.sendAsClient(client, {
            to: { email: msg.to_email, name: conv.lead_name || '' },
            cc: ccEmail ? { email: ccEmail } : null,
            subject: msg.subject,
            body: msg.body,
            threadId: conv.thread_id || msg.gmail_thread_id || undefined,
          });
        }
      } else {
        result = await google.sendAsClient(client, {
          to: { email: msg.to_email, name: conv.lead_name || '' },
          cc: ccEmail ? { email: ccEmail } : null,
          subject: msg.subject,
          body: msg.body,
          threadId: conv.thread_id || msg.gmail_thread_id || undefined,
        });
      }
      await messagesRepo.markSent(msg.id, {
        gmail_message_id: result.messageId,
        gmail_thread_id: result.threadId,
      });
      if (result.threadId) {
        await conversationsRepo.updateThreadId(conv.id, result.threadId);
      }
      out.sent += 1;
    } catch (err) {
      await messagesRepo.markFailed(msg.id, err.code ? `${err.code}: ${err.message}` : String(err.message || err));
      out.failed += 1;
    }
  }
  res.json({ ok: true, ...out });
});

module.exports = router;
