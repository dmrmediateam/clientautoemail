'use strict';
/**
 * Activate the OCBV buyer campaign starting TODAY.
 * Schedules burst batches across numDays starting from today's window.
 */
require('dotenv').config();
const { query } = require('../src/db');
const { buildScheduleTimes, zonedParts } = require('../src/services/bulkCampaign');

const TAG      = 'ocbv_buyer_2026';
const NUM_DAYS = 3;
const TIMEZONE = 'America/Chicago';
const WIN_START = '08:30';
const WIN_END   = '18:00';

(async () => {
  const { rows: msgs } = await query(
    `SELECT id FROM messages
     WHERE status = 'scheduled'
       AND raw_payload::jsonb->>'campaign_tag' = $1
     ORDER BY id ASC`,
    [TAG]
  );

  if (!msgs.length) {
    console.log('No scheduled messages found for', TAG);
    process.exit(0);
  }

  console.log(`Found ${msgs.length} scheduled messages. Activating...`);

  // Start from TODAY (not tomorrow)
  const startLocal = zonedParts(Date.now(), TIMEZONE);
  console.log(`Start date: ${startLocal.year}-${String(startLocal.month).padStart(2,'0')}-${String(startLocal.day).padStart(2,'0')} (${TIMEZONE})`);

  const times = buildScheduleTimes(msgs.length, {
    startLocal,
    numDays: NUM_DAYS,
    windowStart: WIN_START,
    windowEnd: WIN_END,
    timezone: TIMEZONE,
  });

  // Show a preview of the schedule
  const first = new Date(times[0]).toLocaleString('en-US', { timeZone: TIMEZONE, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const last  = new Date(times[times.length - 1]).toLocaleString('en-US', { timeZone: TIMEZONE, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  console.log(`Schedule window: ${first} → ${last} (CT)`);

  // Count how many are due immediately (already past scheduled time)
  const dueNow = times.filter(t => t <= Date.now()).length;
  console.log(`Due immediately: ${dueNow}`);

  // Update all messages
  for (let i = 0; i < msgs.length; i++) {
    await query(
      `UPDATE messages SET status = 'queued', scheduled_for = $1 WHERE id = $2`,
      [times[i], msgs[i].id]
    );
  }

  console.log(`\n✓ Activated ${msgs.length} messages.`);
  console.log(`  ${dueNow} are already due — run the send-queued trigger to send them now.`);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
