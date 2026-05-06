'use strict';

const express = require('express');
const config = require('../config');

const router = express.Router();

router.get('/onboarding', (req, res) => {
  const flash = req.query.disconnected
    ? { type: 'info', text: 'Signed out. Sign in again to reconnect.' }
    : null;
  res.render('onboarding', {
    brand: config.brand,
    flash,
  });
});

module.exports = router;
