'use strict';
require('dotenv').config();
const http = require('http');
const { query } = require('../src/db');

const CLIENT_ID = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';
const CRON_SECRET = process.env.CRON_SECRET || '';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = http.request(opts, res => {
      let s = '';
      res.on('data', d => s += d);
      res.on('end', () => resolve({ status: res.statusCode, body: s }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function cronPost() {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3000, path: '/api/cron/send-queued', method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    };
    const req = http.request(opts, res => {
      let s = '';
      res.on('data', d => s += d);
      res.on('end', () => resolve({ status: res.statusCode, body: s }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  // 1. Temporarily clear CC so test email doesn't CC Linda
  await query('UPDATE client_settings SET cc_email = $1 WHERE client_id = $2', ['', CLIENT_ID]);
  console.log('CC cleared for test.');

  // 2. Send Healdsburg seller webhook
  const payload = {
    first_name: 'Max',
    last_name: 'Test',
    email: `max+test${Date.now()}@dmrmedia.org`,
    phone: '707-555-0100',
    property_address: '123 Healdsburg Ave, Healdsburg, CA 95448',
    property_url: 'https://example.com/listing/healdsburg-test',
    message: 'I am interested in selling my home in Healdsburg.',
    source: 'HOME_VALUE',
    lead_type: 'seller',
    _lp_lead_type: 'HOME_VALUE',
  };

  console.log('\nSending Healdsburg seller webhook...');
  const wh = await post(`/v1/webhooks/incoming/${CLIENT_ID}`, payload);
  console.log('Webhook:', wh.status, wh.body);

  // 3. Fire cron
  await new Promise(r => setTimeout(r, 500));
  console.log('\nFiring cron...');
  const cr = await cronPost();
  console.log('Cron:', cr.status, cr.body);

  // 4. Restore CC
  await query('UPDATE client_settings SET cc_email = $1 WHERE client_id = $2', ['linda.farwell@compass.com', CLIENT_ID]);
  console.log('\nCC restored: linda.farwell@compass.com');

  // 5. Show the sent message
  await new Promise(r => setTimeout(r, 800));
  const msgs = await query(
    `SELECT m.id, m.status, m.to_email, m.from_email, m.subject, m.gmail_message_id
     FROM messages m
     WHERE m.client_id = $1
     ORDER BY m.created_at DESC LIMIT 3`,
    [CLIENT_ID]
  );
  console.log('\nLatest messages:');
  msgs.rows.forEach(r => console.log(' ', JSON.stringify(r)));

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
