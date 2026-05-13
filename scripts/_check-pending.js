'use strict';
require('dotenv').config();
const { query } = require('../src/db');

async function run() {
  // Show the pending message body
  const msg = await query('SELECT id, subject, body, status, to_email FROM messages WHERE id = 35');
  console.log('\n=== Pending message #35 ===');
  console.log('To:', msg.rows[0]?.to_email);
  console.log('Subject:', msg.rows[0]?.subject);
  console.log('Status:', msg.rows[0]?.status);
  console.log('Body:\n---\n' + msg.rows[0]?.body + '\n---');

  // Show current seller template
  const s = await query(
    'SELECT seller_template_subject, seller_template_body FROM client_settings WHERE client_id = $1',
    ['ae5ebc7b-3ea3-45de-a0a6-98066037d937']
  );
  console.log('\n=== Current seller template ===');
  console.log('Subject:', s.rows[0]?.seller_template_subject);
  console.log('Body:\n---\n' + s.rows[0]?.seller_template_body + '\n---');

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
