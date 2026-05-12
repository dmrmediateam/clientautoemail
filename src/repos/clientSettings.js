'use strict';

const { query } = require('../db');

function now() { return Date.now(); }

function defaultSettings() {
  return {
    send_window_start: '08:30',
    send_window_end: '18:00',
    timezone: 'America/Chicago',
    daily_send_limit: 5,
    buyer_template_subject: 'Question about {{property_address}}',
    buyer_template_body: '',
    seller_template_subject: 'Question about your home at {{property_address}}',
    seller_template_body: '',
    cc_email: '',
    send_from_email: '',
    buyer_sender_email: '',
    seller_sender_email: '',
    team_signature_enabled: false,
    buyer_paused: false,
    seller_paused: false,
  };
}

function rowOut(row) {
  if (!row) return null;
  return {
    send_window_start: row.send_window_start,
    send_window_end: row.send_window_end,
    timezone: row.timezone,
    daily_send_limit: Number(row.daily_send_limit || 5),
    buyer_template_subject: row.buyer_template_subject,
    buyer_template_body: row.buyer_template_body,
    seller_template_subject: row.seller_template_subject,
    seller_template_body: row.seller_template_body,
    cc_email: row.cc_email || '',
    send_from_email: row.send_from_email || '',
    buyer_sender_email: row.buyer_sender_email || '',
    seller_sender_email: row.seller_sender_email || '',
    team_signature_enabled: !!row.team_signature_enabled,
    buyer_paused: !!row.buyer_paused,
    seller_paused: !!row.seller_paused,
    created_at: Number(row.created_at || 0),
    updated_at: Number(row.updated_at || 0),
  };
}

async function findByClientId(clientId) {
  const r = await query('SELECT * FROM client_settings WHERE client_id = $1', [clientId]);
  return rowOut(r.rows[0]);
}

async function upsert(clientId, patch = {}) {
  const ts = now();
  const existing = await findByClientId(clientId);
  const base = existing || defaultSettings();
  const next = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) next[k] = v;
  }
  await query(
    `INSERT INTO client_settings (
      client_id, send_window_start, send_window_end, timezone, daily_send_limit,
      buyer_template_subject, buyer_template_body, seller_template_subject, seller_template_body,
      cc_email, send_from_email, buyer_sender_email, seller_sender_email, team_signature_enabled,
      buyer_paused, seller_paused, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
    ON CONFLICT (client_id) DO UPDATE SET
      send_window_start = EXCLUDED.send_window_start,
      send_window_end = EXCLUDED.send_window_end,
      timezone = EXCLUDED.timezone,
      daily_send_limit = EXCLUDED.daily_send_limit,
      buyer_template_subject = EXCLUDED.buyer_template_subject,
      buyer_template_body = EXCLUDED.buyer_template_body,
      seller_template_subject = EXCLUDED.seller_template_subject,
      seller_template_body = EXCLUDED.seller_template_body,
      cc_email = EXCLUDED.cc_email,
      send_from_email = EXCLUDED.send_from_email,
      buyer_sender_email = EXCLUDED.buyer_sender_email,
      seller_sender_email = EXCLUDED.seller_sender_email,
      team_signature_enabled = EXCLUDED.team_signature_enabled,
      buyer_paused = EXCLUDED.buyer_paused,
      seller_paused = EXCLUDED.seller_paused,
      updated_at = EXCLUDED.updated_at`,
    [
      clientId,
      next.send_window_start,
      next.send_window_end,
      next.timezone,
      next.daily_send_limit,
      next.buyer_template_subject,
      next.buyer_template_body,
      next.seller_template_subject,
      next.seller_template_body,
      next.cc_email || '',
      next.send_from_email || '',
      next.buyer_sender_email || '',
      next.seller_sender_email || '',
      next.team_signature_enabled ? true : false,
      next.buyer_paused ? true : false,
      next.seller_paused ? true : false,
      ts,
    ]
  );
  return findByClientId(clientId);
}

module.exports = { defaultSettings, findByClientId, upsert };
