'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const config = require('./src/config');
const { requireAdmin, requireClient } = require('./src/middleware/auth');

const webhookRouter = require('./src/routes/webhook');
const oauthRouter = require('./src/routes/oauth');
const onboardingRouter = require('./src/routes/onboarding');
const dashboardRouter = require('./src/routes/dashboard');
const cronRouter = require('./src/routes/cron');
const adminRouter = require('./src/routes/admin');
const loginRouter = require('./src/routes/login');

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

// Public ingestion (no auth)
app.use('/v1/webhooks', webhookRouter);
app.use('/api/cron', cronRouter);

// Public OAuth + onboarding
app.use('/auth', oauthRouter);
app.use('/', onboardingRouter);

// Client-facing (Google session)
app.use('/dashboard', requireClient, dashboardRouter);

// Operator-facing (admin password)
app.use('/', loginRouter);
app.use('/admin', requireAdmin, adminRouter);

// Root: send agents to onboarding (or dashboard if signed in)
app.get('/', (req, res) => {
  if (req.cookies?.dmr_client_session) return res.redirect('/dashboard');
  res.redirect('/onboarding');
});

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
    if (require.main === module) process.exit(1);
  }
}

module.exports = app;

if (require.main === module) {
  const port = config.port;
  app.listen(port, () => {
    console.log(`[${config.brand.name}] ${config.brand.tagline} listening on ${config.publicBaseUrl} (port ${port})`);
  });
}
