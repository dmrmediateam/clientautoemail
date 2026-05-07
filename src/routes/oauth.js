'use strict';

const express = require('express');
const crypto = require('crypto');
const google = require('../services/google');
const clientsRepo = require('../repos/clients');
const config = require('../config');
const { issueClientSession, clearClientSession } = require('../middleware/auth');

const router = express.Router();

// HMAC-signed stateless OAuth state — no cookie required, works in serverless environments.
function _stateSecret() {
  return config.admin.sessionSecret || config.encryptionKey || '';
}

function _makeState() {
  const nonce = crypto.randomBytes(16).toString('hex');
  const sig = crypto.createHmac('sha256', _stateSecret()).update(nonce).digest('hex');
  return `${nonce}.${sig}`;
}

function _verifyState(state) {
  if (!state || typeof state !== 'string') return false;
  const dot = state.lastIndexOf('.');
  if (dot < 1) return false;
  const nonce = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = crypto.createHmac('sha256', _stateSecret()).update(nonce).digest('hex');
  try {
    const sBuf = Buffer.from(sig, 'hex');
    const eBuf = Buffer.from(expected, 'hex');
    return sBuf.length === eBuf.length && crypto.timingSafeEqual(sBuf, eBuf);
  } catch {
    return false;
  }
}

router.get('/google/start', (req, res) => {
  const state = _makeState();
  const url = google.generateAuthUrl(state);
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Google returned error: ${error}`);
  if (!code || !state) return res.status(400).send('Missing code or state');

  if (!_verifyState(String(state))) {
    return res.status(400).send('Invalid OAuth state — possible CSRF or expired flow. Try again.');
  }

  let tokens;
  try {
    tokens = await google.exchangeCode(String(code));
  } catch (err) {
    console.error('[oauth] code exchange failed:', err);
    return res.status(500).send(`OAuth exchange failed: ${err.message}`);
  }

  if (!tokens.email) {
    return res.status(400).send('Google did not return an email — make sure userinfo.email scope is granted.');
  }

  let client = await clientsRepo.findByGoogleEmail(tokens.email);

  if (!client) {
    if (!tokens.refresh_token) {
      return res.status(400).send(
        'Google did not return a refresh_token. Visit https://myaccount.google.com/permissions, ' +
        'remove access for "DMR Media Lead Bridge", and try connecting again.'
      );
    }
    const fallbackName = tokens.name || tokens.email.split('@')[0];
    client = await clientsRepo.create({
      name: fallbackName,
      website: '',
      agent_name: fallbackName,
      agent_email: tokens.email,
      agent_phone: '',
    });
  } else if (!tokens.refresh_token && !client.google.refresh_token) {
    return res.status(400).send(
      'Google did not return a refresh_token. Visit https://myaccount.google.com/permissions, ' +
      'remove access for "DMR Media Lead Bridge", and try connecting again.'
    );
  }

  await clientsRepo.saveGoogleTokens(client.id, tokens);
  try {
    await google.watchMailbox(
      await clientsRepo.findById(client.id),
      process.env.GMAIL_PUBSUB_TOPIC || ''
    );
  } catch (err) {
    console.warn('[oauth] gmail watch setup skipped:', err.message);
  }
  issueClientSession(res, client.id);
  res.redirect('/dashboard?connected=1');
});

router.post('/logout', (req, res) => {
  clearClientSession(res);
  res.redirect('/onboarding');
});

router.post('/disconnect', async (req, res) => {
  const cookie = req.cookies?.['dmr_client_session'];
  if (cookie) {
    try {
      const payload = JSON.parse(Buffer.from(cookie.split('.')[0], 'base64url').toString('utf8'));
      if (payload.cid) await clientsRepo.clearGoogleTokens(payload.cid);
    } catch { /* ignore */ }
  }
  clearClientSession(res);
  res.redirect('/onboarding?disconnected=1');
});

module.exports = router;
