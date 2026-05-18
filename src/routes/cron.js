'use strict';

const express = require('express');
const messagesRepo = require('../repos/messages');
const conversationsRepo = require('../repos/conversations');
const clientsRepo = require('../repos/clients');
const google = require('../services/google');
const { query } = require('../db');

const router = express.Router();

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return true;
  return req.headers['x-cron-secret'] === secret || req.query.secret === secret;
}

// Shared logic — send all due-queued messages. Used by cron (GET/POST) and admin send-now.
async function sendOneMessage(msg) {
  const [conv, client] = await Promise.all([
    conversationsRepo.findById(msg.conversation_id),
    clientsRepo.findById(msg.client_id),
  ]);
  if (!conv || !client?.google?.connected) {
    await messagesRepo.markFailed(msg.id, 'Conversation/client unavailable for send');
    return { ok: false };
  }
  const ccEmail = client.settings?.cc_email || '';
  const SYSTEM_BCC = { email: 'team@dmrmedia.org' };

  const leadType = conv.lead_type || 'buyer';
  const perTypeSender = leadType === 'seller'
    ? (client.settings?.seller_sender_email || '')
    : (client.settings?.buyer_sender_email || '');
  const sendFromEmail = perTypeSender || client.settings?.send_from_email || '';

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
        threadId: conv.thread_id || msg.gmail_thread_id || undefined,
      });
    }
  } else {
    result = await google.sendAsClient(client, {
      to: { email: msg.to_email, name: conv.lead_name || '' },
      cc: ccEmail ? { email: ccEmail } : null,
      bcc: SYSTEM_BCC,
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
  return { ok: true };
}

async function runSendQueued(res) {
  const due = await messagesRepo.dueQueued(100);
  const out = { total: due.length, sent: 0, failed: 0 };
  for (const msg of due) {
    try {
      const r = await sendOneMessage(msg);
      if (r.ok) out.sent += 1; else out.failed += 1;
    } catch (err) {
      await messagesRepo.markFailed(msg.id, err.code ? `${err.code}: ${err.message}` : String(err.message || err));
      out.failed += 1;
    }
  }
  return res.json({ ok: true, ...out });
}

// Vercel cron sends GET; also keep POST for manual/legacy triggers
router.get('/send-queued', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  return runSendQueued(res);
});

router.post('/send-queued', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  return runSendQueued(res);
});

// ── Daily admin status report ─────────────────────────────────────────────────
// Vercel cron sends GET; keep POST for manual triggers
async function runDailyReport(res) {
  // Skip weekends (Sat=6, Sun=0) in ET
  const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dow = nowET.getDay();
  if (dow === 0 || dow === 6) {
    console.log('[cron/daily-report] skipping — weekend');
    return res.json({ ok: true, skipped: true, reason: 'weekend' });
  }

  try {
    const since24h = Date.now() - 24 * 60 * 60 * 1000;

    // Stats queries (run in parallel)
    const [msgStats, clientStats, failedMsgs, queuedMsgs] = await Promise.all([
      query(`SELECT status, COUNT(*) as n FROM messages
             WHERE created_at > $1 GROUP BY status`, [since24h]),
      query(`SELECT COUNT(*) as total,
                    SUM(CASE WHEN active THEN 1 ELSE 0 END) as active
             FROM clients`),
      query(`SELECT m.id, m.to_email, m.error, m.subject, c.name as client_name
             FROM messages m JOIN clients c ON c.id = m.client_id
             WHERE m.status = 'failed' AND m.created_at > $1
             ORDER BY m.created_at DESC LIMIT 10`, [since24h]),
      query(`SELECT COUNT(*) as n FROM messages WHERE status IN ('queued','pending')
             AND scheduled_for <= $1`, [Date.now() + 4 * 60 * 60 * 1000]),
    ]);

    const stats = {};
    (msgStats.rows || []).forEach(r => { stats[r.status] = Number(r.n); });

    const sent    = stats.sent    || 0;
    const failed  = stats.failed  || 0;
    const queued  = stats.queued  || 0;
    const pending = stats.pending || 0;
    const totalClients = Number(clientStats.rows[0]?.total || 0);
    const activeClients = Number(clientStats.rows[0]?.active || 0);
    const overdueQueued = Number(queuedMsgs.rows[0]?.n || 0);

    const statusEmoji = failed > 0 ? '⚠️' : overdueQueued > 5 ? '🟡' : '✅';
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

    let body = `clientautoemail — Daily Status Report\n`;
    body += `${today}\n`;
    body += `${'─'.repeat(48)}\n\n`;
    body += `${statusEmoji} SYSTEM STATUS: ${failed > 0 ? 'ISSUES DETECTED' : 'All systems operational'}\n\n`;
    body += `LAST 24 HOURS\n`;
    body += `  Sent:     ${sent}\n`;
    body += `  Failed:   ${failed}\n`;
    body += `  Queued:   ${queued}\n`;
    body += `  Pending:  ${pending}\n\n`;
    body += `CLIENTS\n`;
    body += `  Total: ${totalClients}   Active: ${activeClients}\n\n`;

    if (failedMsgs.rows.length > 0) {
      body += `FAILED MESSAGES (last 24h)\n`;
      failedMsgs.rows.forEach(m => {
        body += `  [${m.client_name}] to ${m.to_email}\n`;
        body += `  Error: ${m.error || 'unknown'}\n\n`;
      });
    }

    if (overdueQueued > 0) {
      body += `ATTENTION: ${overdueQueued} message(s) queued/pending due in next 4h\n\n`;
    }

    body += `─────────────────────────────────────────────────\n`;
    body += `DMR Media — clientautoemail\n`;
    body += `https://clientautoemail.vercel.app/admin\n`;

    // Send via team@dmrmedia.org — look up via listUsersForClient using the admin client
    // Find team user across all users (any client) by scanning listUsersForClient per client
    // Simpler: query users table directly and decrypt inline
    const teamUserRow = await clientsRepo.findUserByEmail('team@dmrmedia.org');
    if (!teamUserRow) throw new Error('team@dmrmedia.org user not found');
    // findUserByEmail returns raw row — decrypt tokens for sendAsUserRow
    const enc = require('../crypto');
    const teamUser = {
      email: teamUserRow.email,
      name: teamUserRow.name || 'DMR Media Team',
      access_token: teamUserRow.google_access_token_encrypted ? enc.decrypt(teamUserRow.google_access_token_encrypted) : null,
      refresh_token: teamUserRow.google_refresh_token_encrypted ? enc.decrypt(teamUserRow.google_refresh_token_encrypted) : null,
      expiry: teamUserRow.google_token_expiry ? Number(teamUserRow.google_token_expiry) : 0,
      scope: teamUserRow.google_scope || '',
    };
    if (!teamUser.refresh_token) throw new Error('team@dmrmedia.org has no refresh token — reconnect via /auth/google/start');

    await google.sendAsUserRow(teamUser, 'DMR Media', {
      to: { email: 'max@dmrmedia.org', name: 'Max' },
      subject: `${statusEmoji} clientautoemail — ${today}`,
      body,
    });

    console.log(`[cron/daily-report] sent — sent=${sent} failed=${failed} queued=${queued}`);
    return res.json({ ok: true, sent, failed, queued, pending });
  } catch (err) {
    console.error('[cron/daily-report] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

router.get('/daily-report', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  return runDailyReport(res);
});

router.post('/daily-report', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  return runDailyReport(res);
});

module.exports = router;
module.exports.sendOneMessage = sendOneMessage;
