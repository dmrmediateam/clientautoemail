'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const since = Date.now() - (5 * 24 * 60 * 60 * 1000); // last 5 days

async function main() {
  // --- Messages ---
  const msgs = await query(
    `SELECT m.id, m.status, m.from_email, m.to_email, m.subject,
            cl.name AS client_name, cv.lead_name, cv.lead_type,
            m.sent_at, m.created_at, m.scheduled_for
     FROM messages m
     JOIN conversations cv ON cv.id = m.conversation_id
     JOIN clients cl ON cl.id = cv.client_id
     WHERE m.created_at > $1 OR m.sent_at > $1
     ORDER BY COALESCE(m.sent_at, m.created_at) DESC`,
    [since]
  );

  console.log(`\n=== MESSAGES (last 5 days) === total: ${msgs.rows.length}`);
  msgs.rows.forEach(r => {
    const created  = new Date(Number(r.created_at)).toISOString().slice(0, 16);
    const sent     = r.sent_at     ? new Date(Number(r.sent_at)).toISOString().slice(0, 16)     : 'not-sent';
    const sched    = r.scheduled_for ? new Date(Number(r.scheduled_for)).toISOString().slice(0, 16) : '';
    console.log(` [${r.status}] #${r.id} ${r.client_name} -> ${r.to_email} | ${r.lead_name || '?'} (${r.lead_type}) | sent:${sent}${sched ? ' sched:' + sched : ''} | created:${created}`);
  });

  // --- Status summary ---
  const summary = await query(
    `SELECT m.status, count(*)::int AS cnt
     FROM messages m
     WHERE m.created_at > $1 OR m.sent_at > $1
     GROUP BY m.status ORDER BY cnt DESC`,
    [since]
  );
  console.log('\n=== MESSAGE STATUS BREAKDOWN ===');
  if (summary.rows.length === 0) console.log('  (no messages)');
  summary.rows.forEach(r => console.log(`  ${r.status}: ${r.cnt}`));

  // --- Conversations ---
  const convs = await query(
    `SELECT c.id, c.lead_email, c.lead_name, c.lead_type, c.status, c.source,
            cl.name AS client_name, c.created_at
     FROM conversations c
     JOIN clients cl ON cl.id = c.client_id
     WHERE c.created_at > $1
     ORDER BY c.created_at DESC`,
    [since]
  );

  console.log(`\n=== CONVERSATIONS (last 5 days) === total: ${convs.rows.length}`);
  if (convs.rows.length === 0) console.log('  (none)');
  convs.rows.forEach(r => {
    const d = new Date(Number(r.created_at)).toISOString().slice(0, 16);
    console.log(` [${r.status}] #${r.id} ${r.client_name} | ${r.lead_name || r.lead_email} (${r.lead_type}) | src:${r.source || '?'} | ${d}`);
  });

  // --- Webhooks / new leads received ---
  const webhooks = await query(
    `SELECT w.id, w.client_id, cl.name AS client_name, w.source, w.lead_type,
            w.lead_email, w.lead_name, w.created_at
     FROM webhook_payloads w
     JOIN clients cl ON cl.id = w.client_id
     WHERE w.created_at > $1
     ORDER BY w.created_at DESC`,
    [since]
  ).catch(() => ({ rows: [] })); // table may not exist

  console.log(`\n=== INCOMING WEBHOOKS/LEADS (last 5 days) === total: ${webhooks.rows.length}`);
  if (webhooks.rows.length === 0) console.log('  (none or table not present)');
  webhooks.rows.forEach(r => {
    const d = new Date(Number(r.created_at)).toISOString().slice(0, 16);
    console.log(` #${r.id} ${r.client_name} | ${r.lead_name || r.lead_email} (${r.lead_type}) | src:${r.source || '?'} | ${d}`);
  });

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
