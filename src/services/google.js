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
    const updated = await clientsRepo.saveGoogleTokens(client.id, {
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

function buildRfc822({ from, to, cc, replyTo, subject, body, inReplyTo, references }) {
  const bodyBytes = Buffer.from(String(body || ''), 'utf8').toString('base64');
  const bodyFolded = (bodyBytes.match(/.{1,76}/g) || ['']).join('\r\n');
  const headers = [
    `From: ${formatAddress(from)}`,
    `To: ${formatAddress(to)}`,
    cc && cc.email ? `Cc: ${formatAddress(cc)}` : null,
    replyTo ? `Reply-To: ${formatAddress(replyTo)}` : null,
    `Subject: ${encodeHeaderIfNeeded(subject)}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
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

async function ensureFreshUserToken(userRow) {
  // userRow shape: { email, access_token, refresh_token, expiry, ... } from listUsersForClient
  if (!userRow.refresh_token) {
    throw Object.assign(
      new Error(`User ${userRow.email} has no Google refresh token — they need to reconnect`),
      { code: 'GOOGLE_NOT_CONNECTED' }
    );
  }
  const expired = !userRow.expiry || Date.now() > (userRow.expiry - REFRESH_LEEWAY_MS);
  if (!expired && userRow.access_token) return userRow.access_token;

  const oauth2 = buildOAuthClient();
  oauth2.setCredentials({
    access_token: userRow.access_token || undefined,
    refresh_token: userRow.refresh_token,
    expiry_date: userRow.expiry || undefined,
  });
  const { credentials } = await oauth2.refreshAccessToken();
  // Persist refreshed tokens back to users row
  await clientsRepo.saveUserGoogleTokens(userRow.email, {
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry: credentials.expiry_date || (Date.now() + 3600 * 1000),
    scope: credentials.scope,
  });
  return credentials.access_token;
}

// Send as a specific user row (multi-sender). agentName is the display name in From:.
async function sendAsUserRow(userRow, agentName, { to, cc, subject, body, replyTo, threadId, inReplyTo, references }) {
  const accessToken = await ensureFreshUserToken(userRow);

  const oauth2 = buildOAuthClient();
  oauth2.setCredentials({
    access_token: accessToken,
    refresh_token: userRow.refresh_token,
    expiry_date: userRow.expiry,
  });

  const from = { email: userRow.email, name: agentName || userRow.name || userRow.email };
  const replyToAddr = replyTo || from;

  const raw = toBase64Url(buildRfc822({ from, to, cc: cc || null, replyTo: replyToAddr, subject, body, inReplyTo, references }));
  const gmailClient = google.gmail({ version: 'v1', auth: oauth2 });

  try {
    const res = await gmailClient.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId: threadId || undefined },
    });
    return { messageId: res.data.id || null, threadId: res.data.threadId || null };
  } catch (err) {
    if (err.response?.status === 401) {
      const e = new Error(`Gmail 401 for ${userRow.email} — token revoked`);
      e.code = 'GOOGLE_REVOKED'; e.original = err; throw e;
    }
    if (err.response?.status === 403) {
      const e = new Error(`Gmail 403 for ${userRow.email} — insufficient scope or quota`);
      e.code = 'GOOGLE_FORBIDDEN'; e.original = err; throw e;
    }
    throw err;
  }
}

async function sendAsClient(client, { to, cc, subject, body, replyTo, threadId, inReplyTo, references }) {
  await ensureFreshToken(client);
  const fresh = await clientsRepo.findById(client.id);

  const oauth2 = buildOAuthClient();
  oauth2.setCredentials({
    access_token: fresh.google.access_token,
    refresh_token: fresh.google.refresh_token,
    expiry_date: fresh.google.expiry,
  });

  const fromEmail = fresh.google.email || fresh.agent_email;
  const from = { email: fromEmail, name: fresh.agent_name };
  const replyToAddr = replyTo || from;

  const raw = toBase64Url(buildRfc822({
    from,
    to,
    cc: cc || null,
    replyTo: replyToAddr,
    subject,
    body,
    inReplyTo,
    references,
  }));
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: threadId || undefined,
      },
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

function decodeBodyPart(part) {
  if (!part) return '';
  if (part.body?.data) {
    return Buffer.from(part.body.data, 'base64').toString('utf8');
  }
  if (!part.parts?.length) return '';
  for (const child of part.parts) {
    if (child.mimeType === 'text/plain' && child.body?.data) {
      return Buffer.from(child.body.data, 'base64').toString('utf8');
    }
  }
  return '';
}

function parseHeader(headers, key) {
  const h = (headers || []).find((x) => String(x.name || '').toLowerCase() === key.toLowerCase());
  return h?.value || '';
}

function parseEmailAddress(raw) {
  const value = String(raw || '');
  const match = value.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return value.trim().toLowerCase();
}

async function listInboundMessages(client, maxResults = 15) {
  await ensureFreshToken(client);
  const fresh = await clientsRepo.findById(client.id);
  const oauth2 = buildOAuthClient();
  oauth2.setCredentials({
    access_token: fresh.google.access_token,
    refresh_token: fresh.google.refresh_token,
    expiry_date: fresh.google.expiry,
  });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:inbox newer_than:7d',
    maxResults,
  });
  const ids = list.data.messages || [];
  const out = [];
  for (const item of ids) {
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: item.id,
      format: 'full',
    });
    const payload = full.data.payload || {};
    const headers = payload.headers || [];
    out.push({
      gmail_message_id: full.data.id,
      gmail_thread_id: full.data.threadId,
      internet_message_id: parseHeader(headers, 'Message-ID'),
      from_email: parseEmailAddress(parseHeader(headers, 'From')),
      to_email: parseEmailAddress(parseHeader(headers, 'To')),
      subject: parseHeader(headers, 'Subject') || '',
      body: decodeBodyPart(payload) || full.data.snippet || '',
      internal_date: Number(full.data.internalDate || Date.now()),
    });
  }
  return out;
}

async function watchMailbox(client, topicName) {
  if (!topicName) return null;
  await ensureFreshToken(client);
  const fresh = await clientsRepo.findById(client.id);
  const oauth2 = buildOAuthClient();
  oauth2.setCredentials({
    access_token: fresh.google.access_token,
    refresh_token: fresh.google.refresh_token,
    expiry_date: fresh.google.expiry,
  });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });
  const watch = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName,
      labelIds: ['INBOX'],
    },
  });
  return watch.data;
}

module.exports = {
  generateAuthUrl,
  exchangeCode,
  ensureFreshToken,
  ensureFreshUserToken,
  sendAsClient,
  sendAsUserRow,
  listInboundMessages,
  watchMailbox,
  buildRfc822,
};
