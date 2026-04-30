'use strict';

const crypto = require('crypto');
const config = require('../config');

const COOKIE_NAME = 'dmr_admin_session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

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

function issueSession(res) {
  const token = sign({ u: config.admin.username, exp: Date.now() + SESSION_MAX_AGE_MS });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = verify(token);
  if (!payload) {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  req.admin = payload;
  next();
}

function checkCredentials(username, password) {
  if (!config.admin.password) return false;
  const u = (username || '').trim();
  const p = (password || '').trim();
  if (u !== config.admin.username) return false;
  const a = Buffer.from(p);
  const b = Buffer.from(config.admin.password);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  requireAdmin,
  issueSession,
  clearSession,
  checkCredentials,
  COOKIE_NAME,
};
