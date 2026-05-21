'use strict';
/**
 * Re-schedules all remaining OCBV queued messages starting from RIGHT NOW.
 * Then sends whatever is immediately due.
 */
require('dotenv').config();
const { query } = require('../src/db');
const { buildScheduleTimes, zonedParts } = require('../src/services/bulkCampaign');
const clientsRepo       = require('../src/repos/clients');
const conversationsRepo = require('../src/repos/conversations');
const messagesRepo      = require('../src/repos/messages');
const google            = require('../src/services/google');

const TAG      = 'ocbv_buyer_2026';
const TIMEZONE = 'America/Chicago';
const WIN_START = '08:30';
const WIN_END   = '18:00';
const NUM_DAYS  = 3;
const SYSTEM_BCC = { email: 'team@dmrmedia.org' };

(async () => {
  // Get all still-queued messages
  const { rows: msgs } = await query(
    `SELECT id FROM messages
     WHERE status = 'queued'
       AND raw_payload::jsonb->>'campaign_tag' = $1
     ORDER BY id ASC`,
    [TAG]
  );

  if (!msgs.length) {
    console.log('No queued messages remaining — campaign may already be complete.');
    process.exit(0);
  }

  console.log(`Rescheduling ${msgs.length} remaining messages starting NOW...`);

  // Start from this very moment
  const startLocal = zonedParts(Date.now(), TIMEZONE);

  const times = buildScheduleTimes(msgs.length, {
    startLocal,
    numDays: NUM_DAYS,
    windowStart: WIN_START,
    windowEnd: WIN_END,
    timezone: TIMEZONE,
  });

  for (let i = 0; i < msgs.length; i++) {
    await query(
      `UPDATE messages SET scheduled_for = $1 WHERE id = $2`,
      [times[i], msgs[i].id]
    );
  }

  const dueNow = times.filter(t => t <= Date.now()).length;
  const firstFuture = new Date(times[dueNow]).toLocaleString('en-US', { timeZone: TIMEZONE, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  console.log(`Rescheduled. ${dueNow} due immediately. Next batch after: ${firstFuture} CT`);

  // Now send everything currently due
  console.log('\nSending due messages now...');
  const due = await messagesRepo.dueQueued(100);
  console.log(`Messages due: ${due.length}`);

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
      console.log(`  SENT id=${msg.id} to=${msg.to_email}`);
    } catch (err) {
      await messagesRepo.markFailed(msg.id, err.code ? `${err.code}: ${err.message}` : String(err.message || err));
      failed++;
      console.log(`  FAIL id=${msg.id} to=${msg.to_email} — ${err.message}`);
    }
  }

  console.log(`\nDone: sent=${sent} failed=${failed}`);
  console.log(`\nRemaining queued messages will send on their burst schedule.`);
  console.log(`Run '_trigger-send-queued.js' again in ~45 min for the next burst, or deploy to Vercel for automatic sending.`);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
