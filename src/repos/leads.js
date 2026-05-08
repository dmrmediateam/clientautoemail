'use strict';

const { query } = require('../db');
const conversationsRepo = require('./conversations');
const messagesRepo = require('./messages');

async function record(entry) {
  const ts = Date.now();
  const r = await query(
    `INSERT INTO leads (
      client_id, raw_payload, normalized_payload,
      email_to, email_from, subject, body,
      status, error, message_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
    [
      entry.client_id,
      JSON.stringify(entry.raw_payload || {}),
      JSON.stringify(entry.normalized_payload || {}),
      entry.email_to || '',
      entry.email_from || '',
      entry.subject || '',
      entry.body || '',
      entry.status,
      entry.error || null,
      entry.message_id || null,
      ts,
    ]
  );
  const conversation = await conversationsRepo.findOrCreateForLead({
    client_id: entry.client_id,
    lead_email: entry.email_to || 'unknown@unknown.invalid',
    lead_name: entry.normalized_payload?.full_name || '',
    lead_phone: entry.normalized_payload?.phone || '',
    lead_type: entry.normalized_payload?.lead_type || 'buyer',
    property_address: entry.normalized_payload?.property_address || '',
    source: entry.normalized_payload?.source || '',
    thread_id: null,
  });
  await messagesRepo.create({
    conversation_id: conversation.id,
    client_id: entry.client_id,
    direction: 'outbound',
    from_email: entry.email_from || '',
    to_email: entry.email_to || '',
    subject: entry.subject || '',
    body: entry.body || '',
    status: entry.status || 'queued',
    error: entry.error || null,
    gmail_message_id: entry.message_id || null,
    sent_at: entry.status === 'sent' ? ts : null,
    scheduled_for: ts,
    raw_payload: entry.raw_payload || {},
  });
  return r.rows[0]?.id;
}

async function recentForClient(clientId, limit = 25) {
  const r = await query(
    `SELECT m.id, m.client_id, m.to_email AS email_to, m.from_email AS email_from, m.subject, m.body,
            m.status, m.error, m.gmail_message_id AS message_id, m.created_at,
            c.lead_email, c.lead_name
     FROM messages m
     LEFT JOIN conversations c ON c.id = m.conversation_id
     WHERE m.client_id = $1
     ORDER BY m.created_at DESC LIMIT $2`,
    [clientId, limit]
  );
  return r.rows.map(rowOut);
}

async function recent(limit = 50) {
  const r = await query(
    `SELECT m.id, m.client_id, m.to_email AS email_to, m.from_email AS email_from, m.subject, m.body,
            m.status, m.error, m.gmail_message_id AS message_id, m.created_at,
            clients.name AS client_name
     FROM messages m
     LEFT JOIN clients ON clients.id = m.client_id
     ORDER BY m.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return r.rows.map(rowOut);
}

async function counts(clientId) {
  const where = clientId ? `WHERE direction = 'outbound' AND client_id = $1` : `WHERE direction = 'outbound'`;
  const params = clientId ? [clientId] : [];
  const r = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'sent')::int          AS sent,
       COUNT(*) FILTER (WHERE status = 'failed')::int        AS failed,
       COUNT(*) FILTER (WHERE status = 'queued')::int        AS queued,
       COUNT(*) FILTER (WHERE status = 'rate_limited')::int  AS fallback
     FROM messages
     ${where}`,
    params
  );
  return r.rows[0];
}

function rowOut(row) {
  return { ...row, created_at: Number(row.created_at) };
}

module.exports = { record, recentForClient, recent, counts };
