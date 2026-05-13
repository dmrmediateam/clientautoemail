'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const CLIENT = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';
const MSG_ID = 35;

const NEW_SUBJECT = 'About your home at {{property_address}}';
const NEW_BODY = `Hi {{first_name}},

Thanks for reaching out about your home at {{property_address}}. I'd love to learn more about your goals and put together a complimentary market analysis so you can see exactly what your property is worth right now.

The easiest way to connect is to grab a time directly on my calendar:
https://calendar.app.google/hN1EE8SHftL1XkXj7

Or feel free to call or text me anytime.

Samantha Marquis
{{agent_phone}}
Marquis Farwell Homes | Compass`;

// Rendered version for the existing pending message (George)
const RENDERED_BODY = `Hi George,

Thanks for reaching out about your home at 86 Woelfe Dr, Santa Rosa, CA 95403, USA. I'd love to learn more about your goals and put together a complimentary market analysis so you can see exactly what your property is worth right now.

The easiest way to connect is to grab a time directly on my calendar:
https://calendar.app.google/hN1EE8SHftL1XkXj7

Or feel free to call or text me anytime.

Samantha Marquis
Marquis Farwell Homes | Compass`;

async function run() {
  // 1. Update seller template in client_settings
  await query(
    `UPDATE client_settings
     SET seller_template_subject = $1,
         seller_template_body    = $2,
         updated_at              = $3
     WHERE client_id = $4`,
    [NEW_SUBJECT, NEW_BODY, Date.now(), CLIENT]
  );
  console.log('✓ Seller template updated.');

  // 2. Patch the pending message body so it reflects the updated template + correct signature
  await query(
    `UPDATE messages SET body = $1 WHERE id = $2 AND status = 'pending'`,
    [RENDERED_BODY, MSG_ID]
  );
  console.log('✓ Pending message #' + MSG_ID + ' body updated.');

  // 3. Print final draft for review
  const m = await query('SELECT subject, body FROM messages WHERE id = $1', [MSG_ID]);
  console.log('\n=== FINAL DRAFT (msg #' + MSG_ID + ') ===');
  console.log('To:      greeksndaigos@yahoo.com (George Kokybakos)');
  console.log('Subject:', m.rows[0].subject);
  console.log('Body:\n---');
  console.log(m.rows[0].body);
  console.log('---');

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
