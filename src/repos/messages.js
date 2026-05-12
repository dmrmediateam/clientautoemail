'use strict';

const { query } = require('../db');
const conversationsRepo = require('./conversations');

function now() { return Date.now(); }

function rowOut(row) {
  return {
    ...row,
    id: Number(row.id),
    conversation_id: Number(row.conversation_id),
    scheduled_for: row.scheduled_for ? Number(row.scheduled_for) : null,
    sent_at: row.sent_at ? Number(row.sent_at) : null,
    created_at: Number(row.created_at || 0),
  };
}

async function create(entry) {
  const ts = now();
  const r = await query(
    `INSERT INTO messages (
      conversation_id, client_id, direction, channel,
      from_email, to_email, subject, body,
      gmail_message_id, gmail_thread_id, internet_message_id,
      status, error, scheduled_for, sent_at, raw_payload, created_at
    ) VALUES ($1, $2, $3, COALESCE($4, 'email'), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
    [
      entry.conversation_id,
      entry.client_id,
      entry.direction,
      entry.channel || 'email',
      entry.from_email || '',
      entry.to_email || '',
      entry.subject || '',
      entry.body || '',
      entry.gmail_message_id || null,
      entry.gmail_thread_id || null,
      entry.internet_message_id || null,
      entry.status || 'queued',
      entry.error || null,
      entry.scheduled_for || null,
      entry.sent_at || null,
      entry.raw_payload ? JSON.stringify(entry.raw_payload) : null,
      ts,
    ]
  );
  await conversationsRepo.touch(entry.conversation_id, ts);
  return rowOut(r.rows[0]);
}

async function markSent(id, info = {}) {
  const ts = now();
  const r = await query(
    `UPDATE messages
     SET status = 'sent',
         gmail_message_id = COALESCE($2, gmail_message_id),
         gmail_thread_id = COALESCE($3, gmail_thread_id),
         internet_message_id = COALESCE($4, internet_message_id),
         sent_at = $5,
         error = NULL
     WHERE id = $1
     RETURNING *`,
    [id, info.gmail_message_id || null, info.gmail_thread_id || null, info.internet_message_id || null, ts]
  );
  if (r.rows[0]) await conversationsRepo.touch(r.rows[0].conversation_id, ts);
  return r.rows[0] ? rowOut(r.rows[0]) : null;
}

async function markFailed(id, errorMessage) {
  const r = await query(
    `UPDATE messages
     SET status = 'failed', error = $2
     WHERE id = $1
     RETURNING *`,
    [id, errorMessage || 'unknown error']
  );
  return r.rows[0] ? rowOut(r.rows[0]) : null;
}

async function dueQueued(limit = 100) {
  const ts = now();
  const r = await query(
    `SELECT *
     FROM messages
     WHERE status IN ('queued', 'rate_limited')
       AND (scheduled_for IS NULL OR scheduled_for <= $1)
     ORDER BY COALESCE(scheduled_for, created_at) ASC
     LIMIT $2`,
    [ts, limit]
  );
  return r.rows.map(rowOut);
}

async function countSentForClientToday(clientId, timezone) {
  const r = await query(
    `SELECT COUNT(*)::int AS c
     FROM messages
     WHERE client_id = $1
       AND direction = 'outbound'
       AND status = 'sent'
       AND ((to_timestamp(sent_at / 1000.0) AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date)`,
    [clientId, timezone || 'America/Chicago']
  );
  return Number(r.rows[0]?.c || 0);
}

async function listForConversation(conversationId) {
  const r = await query(
    `SELECT *
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );
  return r.rows.map(rowOut);
}

async function listRecentByClient(clientId, limit = 50) {
  const r = await query(
    `SELECT m.*, c.lead_email, c.lead_name
     FROM messages m
     LEFT JOIN conversations c ON c.id = m.conversation_id
     WHERE m.client_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [clientId, limit]
  );
  return r.rows.map(rowOut);
}

async function getById(id) {
  const r = await query('SELECT * FROM messages WHERE id = $1', [id]);
  return r.rows[0] ? rowOut(r.rows[0]) : null;
}

async function approvePending(conversationId) {
  const r = await query(
    `UPDATE messages
     SET status = 'queued'
     WHERE conversation_id = $1 AND status = 'pending'
     RETURNING id`,
    [conversationId]
  );
  return r.rowCount;
}

async function findByGmailMessageId(gmailMessageId) {
  if (!gmailMessageId) return null;
  const r = await query(
    'SELECT * FROM messages WHERE gmail_message_id = $1 LIMIT 1',
    [gmailMessageId]
  );
  return r.rows[0] ? rowOut(r.rows[0]) : null;
}

module.exports = {
  create,
  markSent,
  markFailed,
  dueQueued,
  countSentForClientToday,
  listForConversation,
  listRecentByClient,
  getById,
  findByGmailMessageId,
  approvePending,
};
