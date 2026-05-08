'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const BUYER_SUBJECT = 'Question about {{property_address}}';
const BUYER_BODY = `Hi {{first_name}},

Thanks for your interest in {{property_address}}. I wanted to reach out personally to see what questions you have and whether you'd like to schedule a quick tour this week.

When works best for you?

{{agent_name}}
{{agent_phone}}`;

const SELLER_SUBJECT = 'About your home at {{property_address}}';
const SELLER_BODY = `Hi {{first_name}},

Thanks for reaching out about your home at {{property_address}}. I'd love to learn more about your goals and put together a complimentary market analysis so you can see exactly what your property is worth right now.

Would you have 15 minutes for a quick call this week? I can work around your schedule.

{{agent_name}}
{{agent_phone}}`;

async function run() {
  const ts = Date.now();
  const r = await query(`
    UPDATE client_settings
    SET
      buyer_template_subject  = $1,
      buyer_template_body     = $2,
      seller_template_subject = $3,
      seller_template_body    = $4,
      updated_at              = $5
    RETURNING client_id
  `, [BUYER_SUBJECT, BUYER_BODY, SELLER_SUBJECT, SELLER_BODY, ts]);

  console.log(`Updated ${r.rowCount} client(s):`, r.rows.map(r => r.client_id));
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
