'use strict';

require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function optional(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),
  publicBaseUrl: optional('PUBLIC_BASE_URL', 'http://localhost:3000').replace(/\/$/, ''),

  brand: {
    name: optional('BRAND_NAME', 'DMR Media'),
    tagline: optional('BRAND_TAGLINE', 'Lead Response Bridge'),
    domain: optional('BRAND_DOMAIN', 'dmrmedia.org'),
  },

  admin: {
    username: optional('ADMIN_USERNAME', 'admin'),
    password: optional('ADMIN_PASSWORD', ''),
    sessionSecret: optional('SESSION_SECRET', ''),
    alertEmail: optional('ADMIN_ALERT_EMAIL', ''),
  },

  encryptionKey: optional('ENCRYPTION_KEY', ''),

  google: {
    clientId: optional('GOOGLE_CLIENT_ID', ''),
    clientSecret: optional('GOOGLE_CLIENT_SECRET', ''),
    scopes: optional(
      'GOOGLE_OAUTH_SCOPES',
      'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
    ).split(/\s+/).filter(Boolean),
    get redirectUri() {
      return `${config.publicBaseUrl}/auth/google/callback`;
    },
  },

  database: {
    url: optional('DATABASE_URL', '') || optional('POSTGRES_URL', ''),
    ssl: optional('DATABASE_SSL', 'auto') !== 'false',
    max: parseInt(optional('DATABASE_POOL_MAX', '3'), 10),
  },

  cron: {
    secret: optional('CRON_SECRET', ''),
  },

  gmailPush: {
    topic: optional('GMAIL_PUBSUB_TOPIC', ''),
    verificationToken: optional('GMAIL_PUSH_VERIFICATION_TOKEN', ''),
  },
};

function assertProductionConfig() {
  const missing = [];
  if (!config.encryptionKey || config.encryptionKey.length !== 64) {
    missing.push('ENCRYPTION_KEY (must be 64 hex chars / 32 bytes)');
  }
  if (!config.admin.password || config.admin.password === 'change-me-now') {
    missing.push('ADMIN_PASSWORD');
  }
  if (!config.google.clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!config.google.clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!config.database.url) missing.push('DATABASE_URL');
  return missing;
}

config.assertProductionConfig = assertProductionConfig;
config.required = required;

module.exports = config;
