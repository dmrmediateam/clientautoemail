'use strict';
require('dotenv').config();
const { query } = require('../src/db');
async function run() {
  await query("UPDATE users SET name = 'Samantha Marquis' WHERE email = 'samantha.marquis@compass.com'");
  const r = await query('SELECT email, name FROM users WHERE client_id = $1', ['ae5ebc7b-3ea3-45de-a0a6-98066037d937']);
  console.log(r.rows);
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
