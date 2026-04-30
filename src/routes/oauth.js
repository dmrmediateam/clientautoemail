'use strict';

const express = require('express');
const crypto = require('crypto');
const google = require('../services/google');
const clientsRepo = require('../repos/clients');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const STATE_COOKIE = 'dmr_oauth_state';

router.get('/google/start/:client_uuid', requireAdmin, (req, res) => {
  const client = clientsRepo.findById(req.params.client_uuid);
  if (!client) return res.status(404).send('Unknown client');

  const stateNonce = crypto.randomBytes(16).toString('hex');
  const statePayload = `${client.id}:${stateNonce}`;

  res.cookie(STATE_COOKIE, statePayload, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.app.get('env') === 'production',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const url = google.generateAuthUrl(statePayload);
  res.redirect(url);
});

router.get('/google/callback', requireAdmin, async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Google returned error: ${error}`);
  if (!code || !state) return res.status(400).send('Missing code or state');

  const cookieState = req.cookies?.[STATE_COOKIE];
  if (!cookieState || cookieState !== state) {
    return res.status(400).send('Invalid OAuth state — possible CSRF or expired flow');
  }
  res.clearCookie(STATE_COOKIE, { path: '/' });

  const [clientId] = String(state).split(':');
  const client = clientsRepo.findById(clientId);
  if (!client) return res.status(404).send('Unknown client');

  try {
    const tokens = await google.exchangeCode(String(code));
    if (!tokens.refresh_token && !client.google.refresh_token) {
      return res.status(400).send(
        'Google did not return a refresh_token. Visit https://myaccount.google.com/permissions, ' +
        'remove access for this app, and try connecting again.'
      );
    }
    clientsRepo.saveGoogleTokens(client.id, tokens);
    res.redirect(`/admin/clients/${client.id}?connected=1`);
  } catch (err) {
    console.error('[oauth] callback error:', err);
    res.status(500).send(`OAuth exchange failed: ${err.message}`);
  }
});

router.post('/google/disconnect/:client_uuid', requireAdmin, (req, res) => {
  const client = clientsRepo.findById(req.params.client_uuid);
  if (!client) return res.status(404).send('Unknown client');
  clientsRepo.clearGoogleTokens(client.id);
  res.redirect(`/admin/clients/${client.id}?disconnected=1`);
});

module.exports = router;
