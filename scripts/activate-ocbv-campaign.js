'use strict';
/**
 * Step 2 — Activate: Ocean Breeze Villa TCI buyer outreach
 *
 * Finds all messages previously imported by import-ocbv-leads.js
 * (status = 'scheduled', campaign_tag = 'ocbv_buyer_2026'), assigns
 * scheduled_for times spread evenly across N business days starting
 * from tomorrow, and flips status to 'queued' so the cron picks them up.
 *
 * Prerequisites:
 *   1. import-ocbv-leads.js has been run (messages exist with status=scheduled)
 *   2. max@dmrmedia.org has connected their Gmail account
 *
 * Usage:
 *   node scripts/activate-ocbv-campaign.js --dry-run        # preview schedule
 *   node scripts/activate-ocbv-campaign.js                  # go live
 *   node scripts/activate-ocbv-campaign.js --days=3         # spread over 3 days instead of 2
 *   node scripts/activate-ocbv-campaign.js --start=2026-05-21  # specific start date (YYYY-MM-DD)
 */
require('dotenv').config();

const { query } = require('../src/db');

const DRY_RUN     = process.argv.includes('--dry-run');
const CAMPAIGN_TAG = 'ocbv_buyer_2026';

// Parse --days=N flag (default 2)
const daysArg = process.argv.find(a => a.startsWith('--days='));
const NUM_DAYS = daysArg ? Math.max(1, parseInt(daysArg.split('=')[1], 10)) : 2;

// Parse --start=YYYY-MM-DD flag (default: tomorrow)
const startArg = process.argv.find(a => a.startsWith('--start='));

// ── Timezone / scheduling helpers ─────────────────────────────────────────────

function parseHm(s, fallback = '08:30') {
  const m = String(s || fallback).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return parseHm(fallback);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

function zonedParts(epochMs, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(epochMs)).map(p => [p.type, p.value])
  );
  return {
    year:   +parts.year,
    month:  +parts.month,
    day:    +parts.day,
    hour:   +parts.hour,
    minute: +parts.minute,
    second: +parts.second,
  };
}

function zonedToEpoch({ year, month, day, hour, minute, second = 0 }, tz) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const actual   = zonedParts(utcGuess, tz);
  const actualMs = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
  return utcGuess - (actualMs - utcGuess);
}

/**
 * Natural burst-batch scheduler.
 *
 * Groups emails into small bursts of MIN_BATCH–MAX_BATCH, with tight
 * within-burst spacing (WITHIN_GAP_MIN–WITHIN_GAP_MAX minutes) and
 * longer gaps between bursts (BETWEEN_GAP_MIN–BETWEEN_GAP_MAX minutes).
 * This looks like a human opening their inbox a few times a day.
 */
const MIN_BATCH       = 3;   // emails per burst (min)
const MAX_BATCH       = 5;   // emails per burst (max)
const WITHIN_GAP_MIN  = 1;   // minutes between emails inside a burst
const WITHIN_GAP_MAX  = 4;
const BETWEEN_GAP_MIN = 40;  // minutes between bursts
const BETWEEN_GAP_MAX = 70;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function buildScheduleTimes(count, { startLocal, numDays, windowStart, windowEnd, timezone }) {
  const tz     = timezone || 'America/Chicago';
  const wStart = parseHm(windowStart, '08:30');
  const wEnd   = parseHm(windowEnd,   '18:00');

  // Build day windows
  const days = [];
  for (let d = 0; d < numDays; d++) {
    const noonRef = Date.UTC(startLocal.year, startLocal.month - 1, startLocal.day + d, 12, 0, 0);
    const loc     = zonedParts(noonRef, tz);
    days.push({
      start: zonedToEpoch({ year: loc.year, month: loc.month, day: loc.day, hour: wStart.hour, minute: wStart.minute }, tz),
      end:   zonedToEpoch({ year: loc.year, month: loc.month, day: loc.day, hour: wEnd.hour,   minute: wEnd.minute   }, tz),
    });
  }

  // Assign batch sizes (3–5) until all leads are covered
  const batches = [];
  let remaining = count;
  while (remaining > 0) {
    const size = remaining <= MAX_BATCH
      ? remaining
      : MIN_BATCH + Math.floor(Math.random() * (MAX_BATCH - MIN_BATCH + 1));
    batches.push(Math.min(size, remaining));
    remaining -= size;
  }

  // Walk through days, placing bursts
  const times  = [];
  let dayIdx   = 0;
  let cursor   = days[0].start;

  for (let bi = 0; bi < batches.length; bi++) {
    const batchSize = batches[bi];

    // Estimate how much time this burst needs (max within-gap × emails)
    const burstSpan = (batchSize - 1) * WITHIN_GAP_MAX * 60 * 1000;

    // If burst would exceed today's window, advance to next day
    if (cursor + burstSpan > days[dayIdx].end) {
      dayIdx++;
      if (dayIdx >= days.length) {
        // Overflow: pack remaining at end of last day
        dayIdx = days.length - 1;
        cursor = days[dayIdx].end - burstSpan - 60 * 1000;
      } else {
        cursor = days[dayIdx].start;
      }
    }

    // Place each email in this burst
    for (let i = 0; i < batchSize; i++) {
      times.push(Math.round(cursor));
      if (i < batchSize - 1) {
        cursor += rand(WITHIN_GAP_MIN, WITHIN_GAP_MAX) * 60 * 1000;
      }
    }

    // Gap after this burst before the next one
    cursor += rand(BETWEEN_GAP_MIN, BETWEEN_GAP_MAX) * 60 * 1000;

    // If that gap pushes past today's window, roll to next day start
    if (dayIdx < days.length - 1 && cursor > days[dayIdx].end) {
      dayIdx++;
      cursor = days[dayIdx].start;
    }
  }

  return times;
}

// Format epoch-ms as "Mon May 21 @ 09:14 CDT"
function fmtTime(epochMs, tz) {
  return new Date(epochMs).toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('[activate] DRY RUN — no DB writes\n');

  // Find all scheduled messages for this campaign
  const { rows: msgs } = await query(`
    SELECT m.id, m.client_id, m.to_email, m.subject,
           cs.timezone, cs.send_window_start, cs.send_window_end
    FROM   messages m
    JOIN   client_settings cs ON cs.client_id = m.client_id
    WHERE  m.status = 'scheduled'
      AND  m.raw_payload::jsonb->>'campaign_tag' = $1
    ORDER  BY m.id ASC
  `, [CAMPAIGN_TAG]);

  if (msgs.length === 0) {
    console.log('[activate] No scheduled messages found for campaign:', CAMPAIGN_TAG);
    console.log('[activate] Run import-ocbv-leads.js first.');
    process.exit(0);
  }

  // Use settings from first message (all same client)
  const tz          = msgs[0].timezone          || 'America/Chicago';
  const windowStart = msgs[0].send_window_start  || '08:30';
  const windowEnd   = msgs[0].send_window_end    || '18:00';

  // Determine start date
  let startLocal;
  if (startArg) {
    const [y, mo, d] = startArg.split('=')[1].split('-').map(Number);
    startLocal = { year: y, month: mo, day: d };
  } else {
    // Tomorrow in client timezone
    const tomorrowRef = Date.now() + 24 * 60 * 60 * 1000;
    startLocal        = zonedParts(tomorrowRef, tz);
  }

  // Stats
  const perDay    = Math.ceil(msgs.length / NUM_DAYS);
  const numBursts = Math.ceil(msgs.length / ((MIN_BATCH + MAX_BATCH) / 2));

  console.log(`[activate] Campaign    : ${CAMPAIGN_TAG}`);
  console.log(`[activate] Messages    : ${msgs.length}`);
  console.log(`[activate] Days        : ${NUM_DAYS}`);
  console.log(`[activate] Per day     : ~${perDay}`);
  console.log(`[activate] Window      : ${windowStart} – ${windowEnd} (${tz})`);
  console.log(`[activate] Burst size  : ${MIN_BATCH}–5 emails per burst`);
  console.log(`[activate] Within gap  : ${WITHIN_GAP_MIN}–${WITHIN_GAP_MAX} min between emails in a burst`);
  console.log(`[activate] Between gap : ${BETWEEN_GAP_MIN}–${BETWEEN_GAP_MAX} min between bursts`);
  console.log(`[activate] ~Bursts     : ~${numBursts} total (~${Math.round(numBursts/NUM_DAYS)} per day)`);
  console.log(`[activate] Start date  : ${startLocal.year}-${String(startLocal.month).padStart(2,'0')}-${String(startLocal.day).padStart(2,'0')}`);
  console.log('');

  const times = buildScheduleTimes(msgs.length, {
    startLocal,
    numDays:     NUM_DAYS,
    windowStart,
    windowEnd,
    timezone:    tz,
  });

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    const st  = times[i];
    console.log(`  [${String(i + 1).padStart(2)}] ${msg.to_email.padEnd(38)} → ${fmtTime(st, tz)}`);

    if (DRY_RUN) continue;

    await query(
      `UPDATE messages
       SET status        = 'queued',
           scheduled_for = $1
       WHERE id = $2`,
      [st, msg.id]
    );
  }

  console.log('');
  if (DRY_RUN) {
    console.log(`[activate] DRY RUN complete — ${msgs.length} messages would be queued.`);
    console.log('[activate] Run without --dry-run to go live.');
  } else {
    console.log(`[activate] Done. ${msgs.length} messages set to queued.`);
    console.log('[activate] The cron will begin sending at the scheduled times.');
  }
  process.exit(0);
}

main().catch(e => { console.error('[activate] FATAL:', e.message); process.exit(1); });
