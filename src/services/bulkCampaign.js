'use strict';
/**
 * Bulk / batch campaign helpers.
 * Used by the dashboard UI and the activate-ocbv-campaign.js CLI script.
 */

const { query } = require('../db');

// ── Scheduling constants ──────────────────────────────────────────────────────
const MIN_BATCH       = 3;   // emails per burst (min)
const MAX_BATCH       = 5;   // emails per burst (max)
const WITHIN_GAP_MIN  = 1;   // minutes between emails inside a burst
const WITHIN_GAP_MAX  = 4;
const BETWEEN_GAP_MIN = 40;  // minutes between bursts
const BETWEEN_GAP_MAX = 70;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// ── Timezone helpers ──────────────────────────────────────────────────────────

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
    year: +parts.year, month: +parts.month, day: +parts.day,
    hour: +parts.hour, minute: +parts.minute, second: +parts.second,
  };
}

function zonedToEpoch({ year, month, day, hour, minute, second = 0 }, tz) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const actual   = zonedParts(utcGuess, tz);
  const actualMs = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
  return utcGuess - (actualMs - utcGuess);
}

/**
 * Burst-batch scheduler: groups messages into natural-looking clusters of
 * 3–5 emails sent minutes apart, with 40–70 min gaps between clusters.
 */
function buildScheduleTimes(count, { startLocal, numDays, windowStart, windowEnd, timezone }) {
  const tz     = timezone || 'America/Chicago';
  const wStart = parseHm(windowStart, '08:30');
  const wEnd   = parseHm(windowEnd,   '18:00');

  const days = [];
  for (let d = 0; d < numDays; d++) {
    const noonRef = Date.UTC(startLocal.year, startLocal.month - 1, startLocal.day + d, 12, 0, 0);
    const loc     = zonedParts(noonRef, tz);
    days.push({
      start: zonedToEpoch({ year: loc.year, month: loc.month, day: loc.day, hour: wStart.hour, minute: wStart.minute }, tz),
      end:   zonedToEpoch({ year: loc.year, month: loc.month, day: loc.day, hour: wEnd.hour,   minute: wEnd.minute   }, tz),
    });
  }

  // Assign random batch sizes (3–5)
  const batches = [];
  let remaining = count;
  while (remaining > 0) {
    const size = remaining <= MAX_BATCH
      ? remaining
      : MIN_BATCH + Math.floor(Math.random() * (MAX_BATCH - MIN_BATCH + 1));
    batches.push(Math.min(size, remaining));
    remaining -= size;
  }

  const times  = [];
  let dayIdx   = 0;
  let cursor   = days[0].start;

  for (let bi = 0; bi < batches.length; bi++) {
    const sz        = batches[bi];
    const burstSpan = (sz - 1) * WITHIN_GAP_MAX * 60 * 1000;

    if (cursor + burstSpan > days[dayIdx].end) {
      dayIdx++;
      if (dayIdx >= days.length) {
        dayIdx = days.length - 1;
        cursor = days[dayIdx].end - burstSpan - 60 * 1000;
      } else {
        cursor = days[dayIdx].start;
      }
    }

    for (let i = 0; i < sz; i++) {
      times.push(Math.round(cursor));
      if (i < sz - 1) cursor += rand(WITHIN_GAP_MIN, WITHIN_GAP_MAX) * 60 * 1000;
    }

    cursor += rand(BETWEEN_GAP_MIN, BETWEEN_GAP_MAX) * 60 * 1000;
    if (dayIdx < days.length - 1 && cursor > days[dayIdx].end) {
      dayIdx++;
      cursor = days[dayIdx].start;
    }
  }

  return times;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns counts by status for a given campaign_tag.
 * Also returns human-readable state: 'ready' | 'active' | 'complete' | 'empty'
 * Includes `overdue` count (queued messages whose scheduled_for is past — not yet picked up by cron)
 * and `lastSentAt` (epoch ms of most recently sent message, or null).
 */
async function getStatus(tag) {
  const now = Date.now();
  const [statusRows, overdueRow, lastSentRow] = await Promise.all([
    query(
      `SELECT status, COUNT(*)::int AS count
       FROM   messages
       WHERE  raw_payload::jsonb->>'campaign_tag' = $1
       GROUP  BY status`,
      [tag]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM   messages
       WHERE  raw_payload::jsonb->>'campaign_tag' = $1
         AND  status = 'queued'
         AND  scheduled_for <= $2`,
      [tag, now]
    ),
    query(
      `SELECT MAX(created_at)::bigint AS last_sent
       FROM   messages
       WHERE  raw_payload::jsonb->>'campaign_tag' = $1
         AND  status = 'sent'`,
      [tag]
    ),
  ]);

  const by    = Object.fromEntries(statusRows.rows.map(r => [r.status, r.count]));
  const total = statusRows.rows.reduce((s, r) => s + r.count, 0);
  const scheduled = by.scheduled || 0;
  const queued    = by.queued    || 0;
  const sent      = by.sent      || 0;
  const failed    = by.failed    || 0;
  const overdue   = overdueRow.rows[0]?.count || 0;
  const lastSentAt = lastSentRow.rows[0]?.last_sent ? Number(lastSentRow.rows[0].last_sent) : null;

  let state;
  if (total === 0)                            state = 'empty';
  else if (sent + failed === total)           state = 'complete';
  else if (queued > 0)                        state = 'active';
  else if (scheduled > 0)                     state = 'ready';
  else                                        state = 'complete';

  return { scheduled, queued, sent, failed, total, overdue, lastSentAt, state };
}

/**
 * Assigns burst-scheduled send times and flips status from 'scheduled' → 'queued'.
 * Returns { activated: N } where N is the number of messages queued.
 */
async function activate(tag, { numDays = 2, timezone, windowStart, windowEnd }) {
  const { rows: msgs } = await query(
    `SELECT id FROM messages
     WHERE  status = 'scheduled'
       AND  raw_payload::jsonb->>'campaign_tag' = $1
     ORDER  BY id ASC`,
    [tag]
  );

  if (!msgs.length) return { activated: 0 };

  const tz     = timezone    || 'America/Chicago';
  const wStart = windowStart || '08:30';
  const wEnd   = windowEnd   || '18:00';

  // Start tomorrow in the client's timezone
  const tomorrowMs  = Date.now() + 24 * 60 * 60 * 1000;
  const startLocal  = zonedParts(tomorrowMs, tz);

  const times = buildScheduleTimes(msgs.length, {
    startLocal,
    numDays,
    windowStart: wStart,
    windowEnd:   wEnd,
    timezone:    tz,
  });

  for (let i = 0; i < msgs.length; i++) {
    await query(
      `UPDATE messages SET status = 'queued', scheduled_for = $1 WHERE id = $2`,
      [times[i], msgs[i].id]
    );
  }

  return { activated: msgs.length };
}

/**
 * Rolls queued messages back to 'scheduled' (pauses/cancels the campaign).
 * Returns { deactivated: N }.
 */
async function deactivate(tag) {
  const { rows } = await query(
    `UPDATE messages
     SET    status = 'scheduled', scheduled_for = NULL
     WHERE  status = 'queued'
       AND  raw_payload::jsonb->>'campaign_tag' = $1
     RETURNING id`,
    [tag]
  );
  return { deactivated: rows.length };
}

module.exports = { getStatus, activate, deactivate, buildScheduleTimes, zonedParts };
