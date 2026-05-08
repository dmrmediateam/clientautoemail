'use strict';
const { initDb, close, query } = require('../src/db');

const CLIENT_ID = 'dfa8056c-38c9-4903-ae37-37d1a2015910';

const buyerBody = `Hi {{first_name}},

Thanks for your interest in {{property_address}}. I wanted to reach out personally to see what questions you have and whether you'd like to schedule a quick tour this week.

When works best for you?

{{agent_name}}
{{agent_phone}}
AMarketology Team`;

const sellerBody = `Hi {{first_name}},

Thanks for reaching out about your home at {{property_address}}. I'd love to learn more about your goals and put together a complimentary market analysis so you can see exactly what your property is worth right now.

Would you have 15 minutes for a quick call this week? I can work around your schedule.

{{agent_name}}
{{agent_phone}}
AMarketology Team`;

initDb().then(async () => {
  await query(`
    UPDATE client_settings SET
      buyer_sender_email  = 'producer1564@gmail.com',
      seller_sender_email = 'max@amarketology.com',
      buyer_template_body  = $1,
      seller_template_body = $2
    WHERE client_id = $3
  `, [buyerBody, sellerBody, CLIENT_ID]);

  console.log('Done:');
  console.log('  buyer_sender_email  = producer1564@gmail.com');
  console.log('  seller_sender_email = max@amarketology.com');
  console.log('  Both templates now include "AMarketology Team" in signature');
  await close();
}).catch(e => { console.error(e); process.exit(1); });
