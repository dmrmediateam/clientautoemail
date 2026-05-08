'use strict';
const { initDb, close, query } = require('../src/db');
initDb().then(async () => {
  await query(`UPDATE messages SET scheduled_for = $1 WHERE id IN (15,16)`, [Date.now()]);
  const r = await query(`
    SELECT m.id, m.status, m.from_email, m.to_email, c.lead_type
    FROM messages m JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id IN (15,16) ORDER BY m.id
  `);
  r.rows.forEach(row =>
    console.log('msg', row.id, '| lead_type:', row.lead_type, '| to:', row.to_email, '| status:', row.status)
  );
  await close();
}).catch(e => { console.error(e); process.exit(1); });
