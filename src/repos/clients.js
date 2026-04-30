'use strict';

const crypto = require('crypto');
const { getDb } = require('../db');
const enc = require('../crypto');

function now() { return Date.now(); }

function rowToClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    website: row.website || '',
    agent_name: row.agent_name,
    agent_email: row.agent_email,
    agent_phone: row.agent_phone || '',
    sendgrid_api_key: row.sendgrid_api_key_encrypted ? enc.decrypt(row.sendgrid_api_key_encrypted) : null,
    template: {
      subject: row.template_subject,
      body: row.template_body,
    },
    google: {
      access_token: row.google_access_token_encrypted ? enc.decrypt(row.google_access_token_encrypted) : null,
      refresh_token: row.google_refresh_token_encrypted ? enc.decrypt(row.google_refresh_token_encrypted) : null,
      expiry: row.google_token_expiry || 0,
      scope: row.google_scope || '',
      email: row.google_email || '',
      connected: !!row.google_refresh_token_encrypted,
    },
    active: !!row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function findById(id) {
  const row = getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id);
  return rowToClient(row);
}

function findAll() {
  const rows = getDb().prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
  return rows.map(rowToClient);
}

function create(input) {
  const id = input.id || crypto.randomUUID();
  const ts = now();
  getDb().prepare(`
    INSERT INTO clients (
      id, name, website, agent_name, agent_email, agent_phone,
      sendgrid_api_key_encrypted, template_subject, template_body,
      active, created_at, updated_at
    ) VALUES (
      @id, @name, @website, @agent_name, @agent_email, @agent_phone,
      @sendgrid_api_key_encrypted, @template_subject, @template_body,
      1, @ts, @ts
    )
  `).run({
    id,
    name: input.name,
    website: input.website || null,
    agent_name: input.agent_name,
    agent_email: input.agent_email,
    agent_phone: input.agent_phone || null,
    sendgrid_api_key_encrypted: input.sendgrid_api_key ? enc.encrypt(input.sendgrid_api_key) : null,
    template_subject: input.template_subject || 'Question about {{property_address}}',
    template_body: input.template_body || defaultTemplateBody(),
    ts,
  });
  return findById(id);
}

function update(id, patch) {
  const existing = getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id);
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
    active: patch.active != null ? (patch.active ? 1 : 0) : existing.active,
    sendgrid_api_key_encrypted: patch.sendgrid_api_key !== undefined
      ? (patch.sendgrid_api_key ? enc.encrypt(patch.sendgrid_api_key) : null)
      : existing.sendgrid_api_key_encrypted,
  };
  getDb().prepare(`
    UPDATE clients SET
      name = @name, website = @website,
      agent_name = @agent_name, agent_email = @agent_email, agent_phone = @agent_phone,
      template_subject = @template_subject, template_body = @template_body,
      sendgrid_api_key_encrypted = @sendgrid_api_key_encrypted,
      active = @active, updated_at = @ts
    WHERE id = @id
  `).run({ id, ts, ...next });
  return findById(id);
}

function saveGoogleTokens(id, tokens) {
  const ts = now();
  getDb().prepare(`
    UPDATE clients SET
      google_access_token_encrypted = @access,
      google_refresh_token_encrypted = COALESCE(@refresh, google_refresh_token_encrypted),
      google_token_expiry = @expiry,
      google_scope = @scope,
      google_email = COALESCE(@email, google_email),
      updated_at = @ts
    WHERE id = @id
  `).run({
    id,
    access: tokens.access_token ? enc.encrypt(tokens.access_token) : null,
    refresh: tokens.refresh_token ? enc.encrypt(tokens.refresh_token) : null,
    expiry: tokens.expiry || null,
    scope: tokens.scope || null,
    email: tokens.email || null,
    ts,
  });
  return findById(id);
}

function clearGoogleTokens(id) {
  const ts = now();
  getDb().prepare(`
    UPDATE clients SET
      google_access_token_encrypted = NULL,
      google_refresh_token_encrypted = NULL,
      google_token_expiry = NULL,
      google_scope = NULL,
      google_email = NULL,
      updated_at = ?
    WHERE id = ?
  `).run(ts, id);
  return findById(id);
}

function remove(id) {
  return getDb().prepare('DELETE FROM clients WHERE id = ?').run(id).changes > 0;
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

module.exports = {
  findById,
  findAll,
  create,
  update,
  saveGoogleTokens,
  clearGoogleTokens,
  remove,
  defaultTemplateBody,
};
