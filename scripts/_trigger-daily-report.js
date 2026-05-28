'use strict';
/**
 * Manually triggers the daily admin status report email.
 * Mirrors the logic in /api/cron/daily-report exactly.
 */
require('dotenv').config();
const { query } = require('../src/db');
const clientsRepo = require('../src/repos/clients');
const google = require('../src/services/google');
const enc = require('../src/crypto');

(async () => {
  const since24h = Date.now() - 24 * 60 * 60 * 1000;

  const [msgStats, clientStats, failedMsgs, queuedMsgs, allClientsQ, allUsersQ, settingsQ, invalidGrantQ] = await Promise.all([
    query(`SELECT status, COUNT(*) as n FROM messages WHERE created_at > $1 GROUP BY status`, [since24h]),
    query(`SELECT COUNT(*) as total, SUM(CASE WHEN active THEN 1 ELSE 0 END) as active FROM clients`),
    query(`SELECT m.id, m.to_email, m.error, m.subject, c.name as client_name
           FROM messages m JOIN clients c ON c.id = m.client_id
           WHERE m.status = 'failed' AND m.created_at > $1
           ORDER BY m.created_at DESC LIMIT 10`, [since24h]),
    query(`SELECT COUNT(*) as n FROM messages WHERE status IN ('queued','pending') AND scheduled_for <= $1`, [Date.now() + 4 * 60 * 60 * 1000]),
    query(`SELECT id, name, agent_email, active, google_email,
                  (google_refresh_token_encrypted IS NOT NULL) AS client_connected
           FROM clients ORDER BY name`),
    query(`SELECT client_id, email, name, role,
                  (google_refresh_token_encrypted IS NOT NULL) AS user_connected
           FROM users ORDER BY client_id, role`),
    query(`SELECT client_id, send_from_email, buyer_sender_email, seller_sender_email
           FROM client_settings`),
    query(`SELECT m.client_id, COUNT(*) AS n
           FROM messages m
           WHERE m.status = 'failed' AND m.error ILIKE '%invalid_grant%'
             AND m.created_at > $1
           GROUP BY m.client_id`, [Date.now() - 7 * 24 * 60 * 60 * 1000]),
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
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
  });

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

  // Per-client token health
  const usersByClient = {};
  for (const u of allUsersQ.rows) {
    if (!usersByClient[u.client_id]) usersByClient[u.client_id] = [];
    usersByClient[u.client_id].push(u);
  }
  const settingsByClient = {};
  for (const s of settingsQ.rows) { settingsByClient[s.client_id] = s; }
  const invalidGrantByClient = {};
  for (const r of invalidGrantQ.rows) { invalidGrantByClient[r.client_id] = Number(r.n); }

  body += `CLIENT TOKEN HEALTH\n`;
  body += `${'─'.repeat(48)}\n\n`;

  for (const c of allClientsQ.rows) {
    const settings = settingsByClient[c.id] || {};
    const users = usersByClient[c.id] || [];
    const hasInvalidGrant = (invalidGrantByClient[c.id] || 0) > 0;

    const senderEmails = new Set(
      [settings.send_from_email, settings.buyer_sender_email, settings.seller_sender_email]
        .filter(Boolean).map(e => e.toLowerCase())
    );
    const anyDesignatedDisconnected = [...senderEmails].some(email => {
      const u = users.find(u => u.email.toLowerCase() === email);
      return !u || !u.user_connected;
    });
    const clientOk = c.client_connected && !anyDesignatedDisconnected && !hasInvalidGrant;

    body += `${clientOk ? '[OK]' : '[!!]'} ${c.name}${c.active ? '' : ' (inactive)'}\n`;

    if (settings.send_from_email)     body += `     Default sender:  ${settings.send_from_email}\n`;
    if (settings.buyer_sender_email)  body += `     Buyer sender:    ${settings.buyer_sender_email}\n`;
    if (settings.seller_sender_email) body += `     Seller sender:   ${settings.seller_sender_email}\n`;
    if (!settings.send_from_email && !settings.buyer_sender_email && !settings.seller_sender_email) {
      body += `     Sender: client-level token (${c.google_email || 'unset'})\n`;
    }

    body += `     Client token: ${c.client_connected ? '[OK] connected' : '[!!] DISCONNECTED — reconnect at /auth/google/start'}\n`;

    if (users.length > 0) {
      body += `     Team:\n`;
      for (const u of users) {
        const isDesignated = senderEmails.has(u.email.toLowerCase());
        const tag = isDesignated ? ' (sender)' : '';
        body += `       ${u.email}${tag}: ${u.user_connected ? '[OK] connected' : '[!!] DISCONNECTED — needs to reconnect'}\n`;
      }
    }

    if (hasInvalidGrant) {
      body += `     [!!] invalid_grant errors in last 7 days — token likely revoked\n`;
    }

    body += `\n`;
  }

  body += `─────────────────────────────────────────────────\n`;
  body += `DMR Media — clientautoemail\n`;
  body += `https://email.dmrmedia.org/admin\n`;

  console.log('--- Report Body Preview ---');
  console.log(body);
  console.log('---');
  console.log(`Stats: sent=${sent} failed=${failed} queued=${queued} overdue=${overdueQueued}`);

  // Find team@dmrmedia.org user
  const teamUserRow = await clientsRepo.findUserByEmail('team@dmrmedia.org');
  if (!teamUserRow) throw new Error('team@dmrmedia.org user not found');

  const hasRefresh = !!teamUserRow.google_refresh_token_encrypted;
  console.log(`team@ row: has_refresh=${hasRefresh} scope=${teamUserRow.google_scope || '(none)'}`);
  if (!hasRefresh) throw new Error('team@dmrmedia.org has no refresh token');

  // Build userRow shape matching what sendAsUserRow expects (pre-decrypted)
  const teamUser = {
    email: teamUserRow.email,
    name: teamUserRow.name || 'DMR Media Team',
    access_token:  teamUserRow.google_access_token_encrypted  ? enc.decrypt(teamUserRow.google_access_token_encrypted)  : null,
    refresh_token: teamUserRow.google_refresh_token_encrypted ? enc.decrypt(teamUserRow.google_refresh_token_encrypted) : null,
    expiry: teamUserRow.google_token_expiry ? Number(teamUserRow.google_token_expiry) : 0,
    scope:  teamUserRow.google_scope || '',
  };

  console.log('Sending daily report via team@dmrmedia.org...');
  const result = await google.sendAsUserRow(teamUser, 'DMR Media', {
    to: { email: 'max@dmrmedia.org', name: 'Max' },
    subject: `${statusEmoji} clientautoemail — ${today}`,
    body,
  });

  console.log(`Sent! Gmail message ID: ${result.messageId}`);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
