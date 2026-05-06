'use strict';

function parseHm(input, fallback) {
  const s = String(input || fallback || '08:30');
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return parseHm(fallback || '08:30', '08:30');
  const hour = Math.min(23, Math.max(0, Number(m[1])));
  const minute = Math.min(59, Math.max(0, Number(m[2])));
  return { hour, minute };
}

function zonedParts(epochMs, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(epochMs)).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedDateToEpoch({ year, month, day, hour, minute, second }, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  const actual = zonedParts(utcGuess, timeZone);
  const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second || 0);
  const diff = actualUtc - utcGuess;
  return utcGuess - diff;
}

function inWindow(nowParts, start, end) {
  const minutes = nowParts.hour * 60 + nowParts.minute;
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  return minutes >= startMinutes && minutes <= endMinutes;
}

function nextWindowStart({ nowMs, sendWindowStart, sendWindowEnd, timezone, forceNextDay = false }) {
  const tz = timezone || 'America/Chicago';
  const now = nowMs || Date.now();
  const nowLocal = zonedParts(now, tz);
  const start = parseHm(sendWindowStart, '08:30');
  const end = parseHm(sendWindowEnd, '18:00');
  if (!forceNextDay && inWindow(nowLocal, start, end)) return now;

  const localStartToday = zonedDateToEpoch({
    year: nowLocal.year,
    month: nowLocal.month,
    day: nowLocal.day,
    hour: start.hour,
    minute: start.minute,
    second: 0,
  }, tz);
  if (!forceNextDay && now < localStartToday) return localStartToday;

  const tomorrowNoonUtc = Date.UTC(nowLocal.year, nowLocal.month - 1, nowLocal.day + 1, 12, 0, 0);
  const tomorrowParts = zonedParts(tomorrowNoonUtc, tz);
  return zonedDateToEpoch({
    year: tomorrowParts.year,
    month: tomorrowParts.month,
    day: tomorrowParts.day,
    hour: start.hour,
    minute: start.minute,
    second: 0,
  }, tz);
}

module.exports = { nextWindowStart };
