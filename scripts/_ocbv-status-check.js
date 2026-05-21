'use strict';
require('dotenv').config();
const { query } = require('../src/db');

(async () => {
  // OCBV campaign status breakdown
  const ocbv = await query(`
    SELECT status, COUNT(*) as n FROM messages
    WHERE raw_payload::jsonb->>'campaign_tag' = 'ocbv_buyer_2026'
    GROUP BY status ORDER BY status
  `);
  console.log('=== OCBV Campaign (ocbv_buyer_2026) ===');
  if (ocbv.rows.length === 0) console.log('  (no messages found — campaign tag not found)');
  ocbv.rows.forEach(r => console.log(' ', r.status, ':', r.n));

  // Sample of first few messages with their scheduled_for times
  const sample = await query(`
    SELECT m.id, m.status, m.to_email,
           to_timestamp(COALESCE(m.scheduled_for,0)/1000) AT TIME ZONE 'America/Chicago' as sched_ct
    FROM messages m
    WHERE m.raw_payload::jsonb->>'campaign_tag' = 'ocbv_buyer_2026'
    ORDER BY COALESCE(m.scheduled_for, m.created_at) ASC
    LIMIT 10
  `);
  console.log('\n=== First 10 OCBV messages by schedule time ===');
  sample.rows.forEach(r => console.log(' ', r.id, r.status, r.to_email.padEnd(35), String(r.sched_ct).substring(0,22)));

  // Check if any sent in last 24h overall (from any client)
  const sent24h = await query(`
    SELECT COUNT(*) as n FROM messages
    WHERE status = 'sent' AND created_at > $1
  `, [Date.now() - 24*60*60*1000]);
  console.log('\n=== Sent in last 24h (all clients) ===', sent24h.rows[0].n);

  // Check queued messages that are due right now
  const dueNow = await query(`
    SELECT m.id, m.to_email, m.status,
           to_timestamp(m.scheduled_for/1000) AT TIME ZONE 'America/Chicago' as sched_ct
    FROM messages m
    WHERE status IN ('queued','rate_limited')
      AND (scheduled_for IS NULL OR scheduled_for <= $1)
    ORDER BY scheduled_for ASC LIMIT 10
  `, [Date.now()]);
  console.log('\n=== Messages due NOW (queued/rate_limited past scheduled_for) ===');
  if (dueNow.rows.length === 0) console.log('  (none due)');
  dueNow.rows.forEach(r => console.log(' ', r.id, r.status, r.to_email.padEnd(35), String(r.sched_ct).substring(0,22)));

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
