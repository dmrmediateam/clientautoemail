'use strict';
require('dotenv').config();
const { query } = require('../src/db');
query(
  `SELECT m.id, m.status, m.to_email, m.from_email, m.subject,
          to_timestamp(m.sent_at/1000) AS sent_at,
          to_timestamp(m.created_at/1000) AS created_at,
          c.lead_type, c.lead_email, c.lead_name
   FROM messages m JOIN conversations c ON m.conversation_id = c.id
   WHERE m.client_id = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937'
   ORDER BY m.created_at DESC LIMIT 10`
).then(r => {
  r.rows.forEach(x => console.log(JSON.stringify(x)));
  process.exit();
}).catch(e => { console.error(e.message); process.exit(1); });
