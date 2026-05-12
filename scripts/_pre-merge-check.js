'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const ATX = '7eb429ce-a34c-494e-ab86-8291c32710e9';
const DL  = 'dfa8056c-38c9-4903-ae37-37d1a2015910';

async function main() {
  const [a, b] = await Promise.all([
    query('SELECT id,name,agent_email,agent_name,agent_phone,website,active,google_email, google_refresh_token_encrypted IS NOT NULL as has_google FROM clients WHERE id=$1', [ATX]),
    query('SELECT id,name,agent_email,agent_name,agent_phone,website,active,google_email, google_refresh_token_encrypted IS NOT NULL as has_google FROM clients WHERE id=$1', [DL]),
  ]);
  console.log('MAX ATX:', JSON.stringify(a.rows[0], null, 2));
  console.log('\nMAX DE LEONARDIS:', JSON.stringify(b.rows[0], null, 2));

  const [u1, u2] = await Promise.all([
    query('SELECT email,name,google_refresh_token_encrypted IS NOT NULL as connected FROM users WHERE client_id=$1', [ATX]),
    query('SELECT email,name,google_refresh_token_encrypted IS NOT NULL as connected FROM users WHERE client_id=$1', [DL]),
  ]);
  console.log('\nATX users:', u1.rows);
  console.log('DL users:', u2.rows);

  const [c1, c2] = await Promise.all([
    query('SELECT COUNT(*) FROM conversations WHERE client_id=$1', [ATX]),
    query('SELECT COUNT(*) FROM conversations WHERE client_id=$1', [DL]),
  ]);
  console.log('\nATX convs:', c1.rows[0].count, '  DL convs:', c2.rows[0].count);

  const [s1, s2] = await Promise.all([
    query('SELECT * FROM client_settings WHERE client_id=$1', [ATX]),
    query('SELECT * FROM client_settings WHERE client_id=$1', [DL]),
  ]);
  console.log('\nATX settings:', JSON.stringify(s1.rows[0], null, 2));
  console.log('\nDL settings:', JSON.stringify(s2.rows[0], null, 2));

  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
