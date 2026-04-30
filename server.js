'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const config = require('./src/config');
const { initDb } = require('./src/db');
const { requireAdmin } = require('./src/middleware/auth');

const webhookRouter = require('./src/routes/webhook');
const oauthRouter = require('./src/routes/oauth');
const adminRouter = require('./src/routes/admin');
const loginRouter = require('./src/routes/login');

initDb();

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

app.locals.brand = config.brand;
app.locals.publicBaseUrl = config.publicBaseUrl;

app.use('/v1/webhooks', webhookRouter);

app.use('/', loginRouter);
app.use('/auth', oauthRouter);
app.use('/admin', requireAdmin, adminRouter);

app.get('/', (req, res) => res.redirect('/admin'));

app.get('/healthz', (req, res) => res.json({ ok: true, brand: config.brand.name, env: config.env }));

app.use((req, res) => res.status(404).send('Not found'));

app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

if (config.env === 'production') {
  const missing = config.assertProductionConfig();
  if (missing.length) {
    console.error('[boot] missing required production config:', missing.join(', '));
    process.exit(1);
  }
}

const port = config.port;
app.listen(port, () => {
  console.log(`[${config.brand.name}] ${config.brand.tagline} listening on ${config.publicBaseUrl} (port ${port})`);
});
