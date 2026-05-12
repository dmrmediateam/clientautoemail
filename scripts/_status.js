'use strict';
require('dotenv').config();
const { query } = require('../src/db');

async function main() {
  const clients = await query(
    `SELECT c.name, c.agent_email,
            c.google_refresh_token_encrypted IS NOT NULL as has_token,
            cs.timezone, cs.send_window_start, cs.send_window_end
     FROM clients c
     LEFT JOIN client_settings cs ON cs.client_id = c.id
     WHERE c.active = true ORDER BY c.created_at`
  );
  console.log('\nGMAIL STATUS:');
  clients.rows.forEach(r =>
    console.log(' ', r.has_token ? '[GMAIL OK]' : '[NO GMAIL]', r.name, '|', r.agent_email)
  );

  const pending = await query(
    `SELECT m.id, m.status, m.scheduled_for, m.to_email, cl.name as cn, cv.lead_name
     FROM messages m
     JOIN conversations cv ON cv.id = m.conversation_id
     JOIN clients cl ON cl.id = cv.client_id
     WHERE m.status IN ('pending', 'queued', 'scheduled', 'rate_limited')
     ORDER BY m.created_at DESC`
  );
  console.log('\nPENDING/SCHEDULED MESSAGES:');
  if (pending.rows.length === 0) console.log('  (none)');
  pending.rows.forEach(r =>
    console.log(' ', r.status, '->', r.to_email, '|', r.lead_name || '', '|', r.cn,
      'sched:', r.scheduled_for ? new Date(Number(r.scheduled_for)).toISOString().slice(0, 16) : 'none')
  );

  const today = await query(
    `SELECT c.lead_email, c.lead_name, c.lead_type, c.status, c.source,
            cl.name as cn, c.created_at
     FROM conversations c
     JOIN clients cl ON cl.id = c.client_id
     WHERE c.created_at > $1
     ORDER BY c.created_at DESC`,
    [Date.now() - 86400000]  // last 24 hours
  );
  console.log('\nCONVERSATIONS IN LAST 24h:');
  if (today.rows.length === 0) console.log('  (none)');
  today.rows.forEach(r =>
    console.log(' ', r.status, r.lead_name || r.lead_email, r.lead_type, r.cn, new Date(Number(r.created_at)).toISOString().slice(0, 16))
  );

  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
