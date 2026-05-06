'use strict';

const crypto = require('crypto');
const config = require('../config');
const clientsRepo = require('../repos/clients');

const ADMIN_COOKIE = 'dmr_admin_session';
const CLIENT_COOKIE = 'dmr_client_session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const CLIENT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function sign(payload) {
  if (!config.admin.sessionSecret) {
    throw new Error('SESSION_SECRET is required');
  }
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.admin.sessionSecret).update(json).digest('base64url');
  return `${json}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const [json, sig] = token.split('.');
  if (!json || !sig) return null;
  const expected = crypto.createHmac('sha256', config.admin.sessionSecret).update(json).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    maxAge: maxAgeMs,
    path: '/',
  };
}

// --- Admin session ---

function issueAdminSession(res) {
  const token = sign({ kind: 'admin', u: config.admin.username, exp: Date.now() + SESSION_MAX_AGE_MS });
  res.cookie(ADMIN_COOKIE, token, cookieOptions(SESSION_MAX_AGE_MS));
}

function clearAdminSession(res) {
  res.clearCookie(ADMIN_COOKIE, { path: '/' });
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.[ADMIN_COOKIE];
  const payload = verify(token);
  if (!payload || payload.kind !== 'admin') {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  req.admin = payload;
  next();
}

function checkAdminCredentials(username, password) {
  if (!config.admin.password) return false;
  const u = (username || '').trim();
  const p = (password || '').trim();
  if (u !== config.admin.username) return false;
  const a = Buffer.from(p);
  const b = Buffer.from(config.admin.password);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// --- Client session ---

function issueClientSession(res, clientId) {
  const token = sign({ kind: 'client', cid: clientId, exp: Date.now() + CLIENT_MAX_AGE_MS });
  res.cookie(CLIENT_COOKIE, token, cookieOptions(CLIENT_MAX_AGE_MS));
}

function clearClientSession(res) {
  res.clearCookie(CLIENT_COOKIE, { path: '/' });
}

async function requireClient(req, res, next) {
  const token = req.cookies?.[CLIENT_COOKIE];
  const payload = verify(token);
  if (!payload || payload.kind !== 'client' || !payload.cid) {
    return res.redirect('/onboarding?next=' + encodeURIComponent(req.originalUrl));
  }
  try {
    const client = await clientsRepo.findById(payload.cid);
    if (!client) {
      clearClientSession(res);
      return res.redirect('/onboarding');
    }
    req.client = client;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ADMIN_COOKIE,
  CLIENT_COOKIE,
  requireAdmin,
  issueAdminSession,
  clearAdminSession,
  checkAdminCredentials,
  requireClient,
  issueClientSession,
  clearClientSession,
  // Back-compat aliases used elsewhere
  issueSession: issueAdminSession,
  clearSession: clearAdminSession,
  checkCredentials: checkAdminCredentials,
};
