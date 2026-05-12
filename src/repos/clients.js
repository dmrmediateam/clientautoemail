'use strict';

const crypto = require('crypto');
const { query } = require('../db');
const enc = require('../crypto');
const clientSettingsRepo = require('./clientSettings');
const config = require('../config');

function now() { return Date.now(); }

function rowToClient(row, settings) {
  if (!row) return null;
  const effectiveSettings = settings || clientSettingsRepo.defaultSettings();
  const buyerSubject = effectiveSettings.buyer_template_subject || row.template_subject;
  const buyerBody = effectiveSettings.buyer_template_body || row.template_body;
  return {
    id: row.id,
    name: row.name,
    website: row.website || '',
    agent_name: row.agent_name,
    agent_email: row.agent_email,
    agent_phone: row.agent_phone || '',
    sendgrid_api_key: row.sendgrid_api_key_encrypted ? enc.decrypt(row.sendgrid_api_key_encrypted) : null,
    template: {
      subject: buyerSubject,
      body: buyerBody,
    },
    templates: {
      buyer: {
        subject: buyerSubject,
        body: buyerBody,
      },
      seller: {
        subject: effectiveSettings.seller_template_subject || buyerSubject,
        body: effectiveSettings.seller_template_body || buyerBody,
      },
    },
    settings: {
      send_window_start: effectiveSettings.send_window_start,
      send_window_end: effectiveSettings.send_window_end,
      timezone: effectiveSettings.timezone,
      daily_send_limit: Number(effectiveSettings.daily_send_limit || 5),
      buyer_template_subject: buyerSubject,
      buyer_template_body: buyerBody,
      seller_template_subject: effectiveSettings.seller_template_subject || buyerSubject,
      seller_template_body: effectiveSettings.seller_template_body || buyerBody,
      cc_email: effectiveSettings.cc_email || '',
      send_from_email: effectiveSettings.send_from_email || '',
      buyer_sender_email: effectiveSettings.buyer_sender_email || '',
      seller_sender_email: effectiveSettings.seller_sender_email || '',
      team_signature_enabled: !!effectiveSettings.team_signature_enabled,
    },
    google: {
      access_token: row.google_access_token_encrypted ? enc.decrypt(row.google_access_token_encrypted) : null,
      refresh_token: row.google_refresh_token_encrypted ? enc.decrypt(row.google_refresh_token_encrypted) : null,
      expiry: row.google_token_expiry ? Number(row.google_token_expiry) : 0,
      scope: row.google_scope || '',
      email: row.google_email || '',
      connected: !!row.google_refresh_token_encrypted,
    },
    active: !!row.active,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

async function findById(id) {
  const r = await query('SELECT * FROM clients WHERE id = $1', [id]);
  if (!r.rows[0]) return null;
  const settings = await clientSettingsRepo.findByClientId(id);
  return rowToClient(r.rows[0], settings);
}

async function findByGoogleEmail(email) {
  if (!email) return null;
  const r = await query(
    'SELECT * FROM clients WHERE LOWER(google_email) = LOWER($1) OR LOWER(agent_email) = LOWER($1) LIMIT 1',
    [email]
  );
  if (!r.rows[0]) return null;
  const settings = await clientSettingsRepo.findByClientId(r.rows[0].id);
  return rowToClient(r.rows[0], settings);
}

async function findAll() {
  // Exclude the system/admin client (DMR Media Team) from all listings
  const adminEmail = config.admin.superAdminEmail;
  const r = await query(
    'SELECT * FROM clients WHERE agent_email != $1 ORDER BY created_at DESC',
    [adminEmail]
  );
  const out = [];
  for (const row of r.rows) {
    const settings = await clientSettingsRepo.findByClientId(row.id);
    out.push(rowToClient(row, settings));
  }
  return out;
}

async function create(input) {
  const id = input.id || crypto.randomUUID();
  const ts = now();
  await query(
    `INSERT INTO clients (
      id, name, website, agent_name, agent_email, agent_phone,
      sendgrid_api_key_encrypted, template_subject, template_body,
      active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $10)`,
    [
      id,
      input.name,
      input.website || null,
      input.agent_name,
      input.agent_email,
      input.agent_phone || null,
      input.sendgrid_api_key ? enc.encrypt(input.sendgrid_api_key) : null,
      input.template_subject || 'Question about {{property_address}}',
      input.template_body || defaultTemplateBody(),
      ts,
    ]
  );
  await clientSettingsRepo.upsert(id, {
    buyer_template_subject: input.template_subject || 'Question about {{property_address}}',
    buyer_template_body: input.template_body || defaultTemplateBody(),
    seller_template_subject: input.template_subject || 'Question about your home at {{property_address}}',
    seller_template_body: input.template_body || defaultTemplateBody(),
  });
  return findById(id);
}

async function update(id, patch) {
  const r = await query('SELECT * FROM clients WHERE id = $1', [id]);
  const existing = r.rows[0];
  if (!existing) return null;
  const ts = now();
  const next = {
    name: patch.name ?? existing.name,
    website: patch.website ?? existing.website,
    agent_name: patch.agent_name ?? existing.agent_name,
    agent_email: patch.agent_email ?? existing.agent_email,
    agent_phone: patch.agent_phone ?? existing.agent_phone,
    template_subject: patch.template_subject ?? existing.template_subject,
    template_body: patch.template_body ?? existing.template_body,
    active: patch.active != null ? !!patch.active : !!existing.active,
    sendgrid_api_key_encrypted: patch.sendgrid_api_key !== undefined
      ? (patch.sendgrid_api_key ? enc.encrypt(patch.sendgrid_api_key) : null)
      : existing.sendgrid_api_key_encrypted,
  };
  await query(
    `UPDATE clients SET
      name = $2, website = $3,
      agent_name = $4, agent_email = $5, agent_phone = $6,
      template_subject = $7, template_body = $8,
      sendgrid_api_key_encrypted = $9,
      active = $10, updated_at = $11
    WHERE id = $1`,
    [
      id,
      next.name, next.website,
      next.agent_name, next.agent_email, next.agent_phone,
      next.template_subject, next.template_body,
      next.sendgrid_api_key_encrypted,
      next.active, ts,
    ]
  );
  await clientSettingsRepo.upsert(id, {
    buyer_template_subject: next.template_subject,
    buyer_template_body: next.template_body,
    seller_template_subject: patch.seller_template_subject ?? undefined,
    seller_template_body: patch.seller_template_body ?? undefined,
    send_window_start: patch.send_window_start ?? undefined,
    send_window_end: patch.send_window_end ?? undefined,
    timezone: patch.timezone ?? undefined,
    daily_send_limit: patch.daily_send_limit ?? undefined,
    cc_email: patch.cc_email ?? undefined,
    buyer_sender_email: patch.buyer_sender_email ?? undefined,
    seller_sender_email: patch.seller_sender_email ?? undefined,
    team_signature_enabled: patch.team_signature_enabled ?? undefined,
  });
  return findById(id);
}

async function saveGoogleTokens(id, tokens) {
  const ts = now();
  await query(
    `UPDATE clients SET
      google_access_token_encrypted = $2,
      google_refresh_token_encrypted = COALESCE($3, google_refresh_token_encrypted),
      google_token_expiry = $4,
      google_scope = $5,
      google_email = COALESCE($6, google_email),
      updated_at = $7
    WHERE id = $1`,
    [
      id,
      tokens.access_token ? enc.encrypt(tokens.access_token) : null,
      tokens.refresh_token ? enc.encrypt(tokens.refresh_token) : null,
      tokens.expiry || null,
      tokens.scope || null,
      tokens.email || null,
      ts,
    ]
  );
  return findById(id);
}

async function clearGoogleTokens(id) {
  const ts = now();
  await query(
    `UPDATE clients SET
      google_access_token_encrypted = NULL,
      google_refresh_token_encrypted = NULL,
      google_token_expiry = NULL,
      google_scope = NULL,
      google_email = NULL,
      updated_at = $2
    WHERE id = $1`,
    [id, ts]
  );
  return findById(id);
}

async function remove(id) {
  const r = await query('DELETE FROM clients WHERE id = $1', [id]);
  return r.rowCount > 0;
}

// --- Users (multi-user per client account) ---

async function findUserByEmail(email) {
  if (!email) return null;
  const r = await query(
    'SELECT * FROM users WHERE email = LOWER($1) LIMIT 1',
    [email]
  );
  return r.rows[0] || null;
}

async function upsertUser({ email, name, clientId, role }) {
  const t = now();
  const r = await query(
    `INSERT INTO users (id, email, name, client_id, role, created_at, updated_at)
     VALUES (gen_random_uuid()::text, LOWER($1), $2, $3, $4, $5, $5)
     ON CONFLICT (email)
     DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name), updated_at = $5
     RETURNING *`,
    [email, name || null, clientId, role || 'member', t]
  );
  return r.rows[0];
}

// Save Google tokens to a user row (for multi-sender support)
async function saveUserGoogleTokens(email, tokens) {
  const t = now();
  await query(
    `UPDATE users SET
       google_access_token_encrypted  = $2,
       google_refresh_token_encrypted = COALESCE($3, google_refresh_token_encrypted),
       google_token_expiry            = $4,
       google_scope                   = $5,
       google_connected               = TRUE,
       updated_at                     = $6
     WHERE email = LOWER($1)`,
    [
      email,
      tokens.access_token ? enc.encrypt(tokens.access_token) : null,
      tokens.refresh_token ? enc.encrypt(tokens.refresh_token) : null,
      tokens.expiry || null,
      tokens.scope || null,
      t,
    ]
  );
}

async function clearUserGoogleTokens(email) {
  const t = now();
  await query(
    `UPDATE users SET
       google_access_token_encrypted  = NULL,
       google_refresh_token_encrypted = NULL,
       google_token_expiry            = NULL,
       google_scope                   = NULL,
       google_connected               = FALSE,
       updated_at                     = $2
     WHERE email = LOWER($1)`,
    [email, t]
  );
}

// Returns all users for a client with their connection status
async function listUsersForClient(clientId) {
  const r = await query(
    `SELECT id, email, name, role, google_connected,
            google_access_token_encrypted, google_refresh_token_encrypted,
            google_token_expiry, google_scope
     FROM users WHERE client_id = $1 ORDER BY role DESC, created_at ASC`,
    [clientId]
  );
  return r.rows.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name || u.email,
    role: u.role,
    connected: !!u.google_connected,
    access_token: u.google_access_token_encrypted ? enc.decrypt(u.google_access_token_encrypted) : null,
    refresh_token: u.google_refresh_token_encrypted ? enc.decrypt(u.google_refresh_token_encrypted) : null,
    expiry: u.google_token_expiry ? Number(u.google_token_expiry) : 0,
    scope: u.google_scope || '',
  }));
}

function defaultTemplateBody() {
  return [
    'Hi {{first_name}},',
    '',
    'Thanks for your interest in {{property_address}}. I wanted to reach out personally to see what questions you have and whether you\'d like to schedule a quick tour this week.',
    '',
    'When works best for you?',
    '',
    '{{agent_name}}',
    '{{agent_phone}}',
  ].join('\n');
}

function defaultSellerTemplateBody() {
  return [
    'Hi {{first_name}},',
    '',
    'Thanks for reaching out about your home at {{property_address}}. I\'d love to learn more about your goals and put together a complimentary market analysis so you can see exactly what your property is worth right now.',
    '',
    'Would you have 15 minutes for a quick call this week? I can work around your schedule.',
    '',
    '{{agent_name}}',
    '{{agent_phone}}',
  ].join('\n');
}

module.exports = {
  findById,
  findByGoogleEmail,
  findUserByEmail,
  upsertUser,
  saveUserGoogleTokens,
  clearUserGoogleTokens,
  listUsersForClient,
  findAll,
  create,
  update,
  saveGoogleTokens,
  clearGoogleTokens,
  remove,
  defaultTemplateBody,
  defaultSellerTemplateBody,
  upsertSettings: clientSettingsRepo.upsert,
};
