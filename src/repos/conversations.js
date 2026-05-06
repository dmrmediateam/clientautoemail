'use strict';

const { query } = require('../db');

function now() { return Date.now(); }

function rowOut(row) {
  return {
    ...row,
    id: Number(row.id),
    last_message_at: Number(row.last_message_at || 0),
    created_at: Number(row.created_at || 0),
    updated_at: Number(row.updated_at || 0),
  };
}

async function findById(id) {
  const r = await query(
    `SELECT c.*, cl.name AS client_name
     FROM conversations c
     LEFT JOIN clients cl ON cl.id = c.client_id
     WHERE c.id = $1`,
    [id]
  );
  return r.rows[0] ? rowOut(r.rows[0]) : null;
}

async function findByClientAndThread(clientId, threadId) {
  if (!threadId) return null;
  const r = await query(
    'SELECT * FROM conversations WHERE client_id = $1 AND thread_id = $2 ORDER BY updated_at DESC LIMIT 1',
    [clientId, threadId]
  );
  return r.rows[0] ? rowOut(r.rows[0]) : null;
}

async function findByClientAndLead(clientId, leadEmail) {
  const r = await query(
    `SELECT * FROM conversations
     WHERE client_id = $1 AND LOWER(lead_email) = LOWER($2)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [clientId, leadEmail]
  );
  return r.rows[0] ? rowOut(r.rows[0]) : null;
}

async function findOrCreateForLead(lead) {
  let conv = null;
  if (lead.thread_id) conv = await findByClientAndThread(lead.client_id, lead.thread_id);
  if (!conv && lead.lead_email) conv = await findByClientAndLead(lead.client_id, lead.lead_email);
  if (conv) {
    const ts = now();
    await query(
      `UPDATE conversations
       SET
         lead_name = COALESCE(NULLIF($2, ''), lead_name),
         lead_phone = COALESCE(NULLIF($3, ''), lead_phone),
         lead_type = COALESCE(NULLIF($4, ''), lead_type),
         property_address = COALESCE(NULLIF($5, ''), property_address),
         source = COALESCE(NULLIF($6, ''), source),
         thread_id = COALESCE(NULLIF($7, ''), thread_id),
         last_message_at = GREATEST(last_message_at, $8),
         updated_at = $8
       WHERE id = $1`,
      [
        conv.id,
        lead.lead_name || '',
        lead.lead_phone || '',
        lead.lead_type || '',
        lead.property_address || '',
        lead.source || '',
        lead.thread_id || '',
        ts,
      ]
    );
    return findById(conv.id);
  }

  const ts = now();
  const r = await query(
    `INSERT INTO conversations (
      client_id, lead_email, lead_name, lead_phone, lead_type,
      property_address, source, status, thread_id, last_message_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $9, $9)
    RETURNING *`,
    [
      lead.client_id,
      lead.lead_email,
      lead.lead_name || null,
      lead.lead_phone || null,
      lead.lead_type || 'buyer',
      lead.property_address || null,
      lead.source || null,
      lead.thread_id || null,
      ts,
    ]
  );
  return rowOut(r.rows[0]);
}

async function touch(id, at = now()) {
  await query('UPDATE conversations SET last_message_at = $2, updated_at = $2 WHERE id = $1', [id, at]);
}

async function listForClient(clientId, limit = 50) {
  const r = await query(
    `SELECT c.*
     FROM conversations c
     WHERE c.client_id = $1
     ORDER BY c.last_message_at DESC
     LIMIT $2`,
    [clientId, limit]
  );
  return r.rows.map(rowOut);
}

async function listWithPreview(clientId, limit = 50) {
  const r = await query(
    `SELECT c.*,
            m.subject AS last_subject,
            m.body AS last_body,
            m.direction AS last_direction,
            m.status AS last_status,
            m.created_at AS last_message_created_at
     FROM conversations c
     LEFT JOIN LATERAL (
       SELECT *
       FROM messages
       WHERE conversation_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) m ON true
     WHERE c.client_id = $1
     ORDER BY c.last_message_at DESC
     LIMIT $2`,
    [clientId, limit]
  );
  return r.rows.map(rowOut);
}

async function updateThreadId(id, threadId) {
  if (!threadId) return;
  await query('UPDATE conversations SET thread_id = $2, updated_at = $3 WHERE id = $1', [id, threadId, now()]);
}

module.exports = {
  findById,
  findByClientAndThread,
  findByClientAndLead,
  findOrCreateForLead,
  touch,
  listForClient,
  listWithPreview,
  updateThreadId,
};
