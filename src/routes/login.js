'use strict';

const express = require('express');
const { checkCredentials, issueSession, clearSession } = require('../middleware/auth');

const router = express.Router();

router.get('/login', (req, res) => {
  res.render('login', { error: null, next: req.query.next || '/admin' });
});

router.post('/login', (req, res) => {
  const ok = checkCredentials(req.body.username, req.body.password);
  if (!ok) {
    return res.status(401).render('login', { error: 'Invalid credentials', next: req.body.next || '/admin' });
  }
  issueSession(res);
  res.redirect(req.body.next || '/admin');
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.redirect('/login');
});

module.exports = router;
