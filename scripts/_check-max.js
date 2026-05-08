'use strict';
const { initDb, close, query } = require('../src/db');
initDb().then(async () => {
  const r = await query(`
    SELECT cs.buyer_sender_email, cs.seller_sender_email,
           cs.buyer_template_subject, cs.buyer_template_body,
           cs.seller_template_subject, cs.seller_template_body,
           c.agent_name, c.name
    FROM client_settings cs
    JOIN clients c ON c.id = cs.client_id
    WHERE cs.client_id = 'dfa8056c-38c9-4903-ae37-37d1a2015910'
  `);
  const row = r.rows[0];
  console.log('=== SENDERS ===');
  console.log('buyer_sender_email:', row.buyer_sender_email);
  console.log('seller_sender_email:', row.seller_sender_email);
  console.log('\n=== CLIENT ===');
  console.log('name:', row.name, '| agent_name:', row.agent_name);
  console.log('\n=== BUYER TEMPLATE ===');
  console.log('Subject:', row.buyer_template_subject);
  console.log('Body:\n', row.buyer_template_body);
  console.log('\n=== SELLER TEMPLATE ===');
  console.log('Subject:', row.seller_template_subject);
  console.log('Body:\n', row.seller_template_body);
  await close();
}).catch(e => { console.error(e); process.exit(1); });
