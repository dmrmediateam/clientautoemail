'use strict';

const { getDb } = require('../db');

function record(entry) {
  const ts = Date.now();
  const info = getDb().prepare(`
    INSERT INTO leads (
      client_id, raw_payload, normalized_payload,
      email_to, email_from, subject, body,
      status, error, message_id, created_at
    ) VALUES (
      @client_id, @raw_payload, @normalized_payload,
      @email_to, @email_from, @subject, @body,
      @status, @error, @message_id, @ts
    )
  `).run({
    client_id: entry.client_id,
    raw_payload: JSON.stringify(entry.raw_payload || {}),
    normalized_payload: JSON.stringify(entry.normalized_payload || {}),
    email_to: entry.email_to || '',
    email_from: entry.email_from || '',
    subject: entry.subject || '',
    body: entry.body || '',
    status: entry.status,
    error: entry.error || null,
    message_id: entry.message_id || null,
    ts,
  });
  return info.lastInsertRowid;
}

function recentForClient(clientId, limit = 25) {
  return getDb()
    .prepare('SELECT * FROM leads WHERE client_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(clientId, limit);
}

function recent(limit = 50) {
  return getDb()
    .prepare(`
      SELECT leads.*, clients.name AS client_name
      FROM leads
      LEFT JOIN clients ON clients.id = leads.client_id
      ORDER BY leads.created_at DESC
      LIMIT ?
    `)
    .all(limit);
}

function counts() {
  return getDb().prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status = 'fallback' THEN 1 ELSE 0 END) AS fallback
    FROM leads
  `).get();
}

module.exports = { record, recentForClient, recent, counts };
