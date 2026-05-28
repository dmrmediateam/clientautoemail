'use strict';
require('dotenv').config();
const { query } = require('../src/db');

(async () => {
  // Check for admin@dmrmedia.org as a user
  const { rows: users } = await query(
    `SELECT u.id, u.email, u.name, u.google_connected,
            (u.google_refresh_token_encrypted IS NOT NULL) as has_refresh,
            c.name as client_name
     FROM users u JOIN clients c ON c.id = u.client_id
     WHERE u.email ILIKE '%dmrmedia%'`
  );
  console.log('DMR Media users:');
  users.forEach(r => console.log(' ', r));

  // Also check clients for google_email = admin@dmrmedia.org
  const { rows: clients } = await query(
    `SELECT id, name, agent_email, google_email,
            (google_refresh_token_encrypted IS NOT NULL) as has_refresh,
            google_connected
     FROM clients WHERE google_email ILIKE '%dmrmedia%' OR agent_email ILIKE '%dmrmedia%'`
  );
  console.log('\nDMR Media clients:');
  clients.forEach(r => console.log(' ', r));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
