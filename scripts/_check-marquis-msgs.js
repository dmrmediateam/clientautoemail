'use strict';
require('dotenv').config();
const { query } = require('../src/db');

(async () => {
  const { rows } = await query(
    `SELECT m.id, m.to_email, m.status, m.error, c.name as client
     FROM messages m JOIN clients c ON c.id = m.client_id
     WHERE c.id = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937'
     ORDER BY m.created_at DESC`
  );
  rows.forEach(r => console.log(r.id, r.to_email, r.status, r.error || ''));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
