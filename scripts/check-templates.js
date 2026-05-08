'use strict';
require('dotenv').config();
const { query } = require('../src/db');
async function run() {
  const r = await query(
    'SELECT buyer_template_subject, buyer_template_body, seller_template_subject, seller_template_body FROM client_settings WHERE client_id = $1',
    [process.argv[2]]
  );
  console.log(JSON.stringify(r.rows[0], null, 2));
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
