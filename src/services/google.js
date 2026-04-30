'use strict';

const { google } = require('googleapis');
const config = require('../config');
const clientsRepo = require('../repos/clients');

const REFRESH_LEEWAY_MS = 5 * 60 * 1000;

function buildOAuthClient() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

function generateAuthUrl(state) {
  const oauth2 = buildOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: config.google.scopes,
    state,
  });
}

async function exchangeCode(code) {
  const oauth2 = buildOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  let email = '';
  let name = '';
  try {
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const me = await oauth2Api.userinfo.get();
    email = me.data?.email || '';
    name = me.data?.name || '';
  } catch (err) {
    console.warn('[google] userinfo fetch failed:', err.message);
  }

  return {
    access_token: tokens.access_token || null,
    refresh_token: tokens.refresh_token || null,
    expiry: tokens.expiry_date || (Date.now() + 3600 * 1000),
    scope: tokens.scope || '',
    email,
    name,
  };
}

async function ensureFreshToken(client) {
  const g = client.google;
  if (!g.refresh_token) {
    throw Object.assign(new Error('Client has no Google refresh token; reconnection required'), { code: 'GOOGLE_NOT_CONNECTED' });
  }

  const expired = !g.expiry || Date.now() > (g.expiry - REFRESH_LEEWAY_MS);
  if (!expired && g.access_token) {
    return g.access_token;
  }

  const oauth2 = buildOAuthClient();
  oauth2.setCredentials({
    access_token: g.access_token || undefined,
    refresh_token: g.refresh_token,
    expiry_date: g.expiry || undefined,
  });

  try {
    const { credentials } = await oauth2.refreshAccessToken();
    const updated = clientsRepo.saveGoogleTokens(client.id, {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      expiry: credentials.expiry_date || (Date.now() + 3600 * 1000),
      scope: credentials.scope,
      email: g.email,
    });
    return updated.google.access_token;
  } catch (err) {
    if (err.response?.status === 400 || err.response?.status === 401) {
      const e = new Error('Google OAuth token revoked or invalid');
      e.code = 'GOOGLE_REVOKED';
      e.original = err;
      throw e;
    }
    throw err;
  }
}

function formatAddress(addr) {
  if (!addr || !addr.email) return '';
  if (!addr.name) return `<${addr.email}>`;
  const safe = String(addr.name).replace(/"/g, '\\"');
  return `"${safe}" <${addr.email}>`;
}

function encodeHeaderIfNeeded(s) {
  const str = String(s || '');
  if (/^[\x20-\x7E]*$/.test(str)) return str;
  return `=?UTF-8?B?${Buffer.from(str, 'utf8').toString('base64')}?=`;
}

function buildRfc822({ from, to, replyTo, subject, body }) {
  const bodyBytes = Buffer.from(String(body || ''), 'utf8').toString('base64');
  const bodyFolded = (bodyBytes.match(/.{1,76}/g) || ['']).join('\r\n');
  const headers = [
    `From: ${formatAddress(from)}`,
    `To: ${formatAddress(to)}`,
    replyTo ? `Reply-To: ${formatAddress(replyTo)}` : null,
    `Subject: ${encodeHeaderIfNeeded(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean).join('\r\n');
  return `${headers}\r\n\r\n${bodyFolded}`;
}

function toBase64Url(s) {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendAsClient(client, { to, subject, body, replyTo }) {
  await ensureFreshToken(client);
  const fresh = clientsRepo.findById(client.id);

  const oauth2 = buildOAuthClient();
  oauth2.setCredentials({
    access_token: fresh.google.access_token,
    refresh_token: fresh.google.refresh_token,
    expiry_date: fresh.google.expiry,
  });

  const fromEmail = fresh.google.email || fresh.agent_email;
  const from = { email: fromEmail, name: fresh.agent_name };
  const replyToAddr = replyTo || from;

  const raw = toBase64Url(buildRfc822({ from, to, replyTo: replyToAddr, subject, body }));
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
    return {
      messageId: res.data.id || null,
      threadId: res.data.threadId || null,
    };
  } catch (err) {
    if (err.response?.status === 401) {
      const e = new Error('Gmail returned 401 — token revoked');
      e.code = 'GOOGLE_REVOKED';
      e.original = err;
      throw e;
    }
    if (err.response?.status === 403) {
      const e = new Error('Gmail returned 403 — insufficient scope or daily quota exceeded');
      e.code = 'GOOGLE_FORBIDDEN';
      e.original = err;
      throw e;
    }
    throw err;
  }
}

module.exports = {
  generateAuthUrl,
  exchangeCode,
  ensureFreshToken,
  sendAsClient,
  buildRfc822,
};
