'use strict';
/**
 * Fire three test webhooks at a client's endpoint:
 *   1. Buyer lead
 *   2. Seller lead (HOME_VALUE)
 *   3. Newsletter signup (should be silently skipped)
 *
 * Usage:
 *   node scripts/test-webhooks.js [baseUrl] [clientId]
 *
 * Defaults to localhost:3000 + Marquis Farwell Homes client ID.
 * All test emails go to max@dmrmedia.org
 */

const https = require('https');
const http  = require('http');

const BASE_URL  = process.argv[2] || 'http://localhost:3000';
const CLIENT_ID = process.argv[3] || 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';
const TO_BASE   = 'max@dmrmedia.org'; // Gmail ignores +tags, all deliver here

const ENDPOINT = `${BASE_URL}/v1/webhooks/incoming/${CLIENT_ID}`;

const payloads = [
  {
    label: '1. BUYER — home search inquiry',
    body: {
      eventName: 'leads',
      companyId: CLIENT_ID,
      data: {
        leadEmail: 'max+buyer@dmrmedia.org',
        leadFirstName: 'Test',
        leadLastName: 'Buyer',
        leadPhoneNumber: '555-111-2222',
        leadSource: 'WEBSITE_INQUIRY',
        activityAction: 'CONTACT_FORM',
        activitySourceUrl: 'https://marquis.com/home-search',
        activityMessage: 'I am looking for a 3 bed 2 bath under $450k in Austin.',
      },
    },
  },
  {
    label: '2. SELLER — home value request',
    body: {
      eventName: 'leads',
      companyId: CLIENT_ID,
      data: {
        leadEmail: 'max+seller@dmrmedia.org',
        leadFirstName: 'Test',
        leadLastName: 'Seller',
        leadPhoneNumber: '555-333-4444',
        leadSource: 'HOME_VALUE',
        activityAction: 'HOME_VALUE',
        activityMessage: 'Geocoded address: 1234 Oak Lane, Austin, TX 78701',
      },
    },
  },
  {
    label: '3. NEWSLETTER — should be skipped (no email sent)',
    body: {
      eventName: 'leads',
      companyId: CLIENT_ID,
      data: {
        leadEmail: 'max+newsletter@dmrmedia.org',
        leadFirstName: 'Test',
        leadLastName: 'Newsletter',
        leadSource: 'NEWSLETTER_SIGNUP',
        activityAction: 'NEWSLETTER_SIGNUP',
      },
    },
  },
];

function post(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log(`\nTarget: ${ENDPOINT}`);
  console.log(`Sending to: max+buyer/seller/newsletter@dmrmedia.org (all deliver to max@dmrmedia.org)\n`);

  for (const p of payloads) {
    console.log(`--- ${p.label}`);
    try {
      const res = await post(ENDPOINT, p.body);
      console.log(`    HTTP ${res.status}  →`, JSON.stringify(res.body));
    } catch (e) {
      console.error(`    ERROR:`, e.message);
    }
    console.log('');
    // Small delay between requests
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('Done.');
})();
