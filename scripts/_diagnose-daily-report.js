'use strict';
require('dotenv').config();
const { query } = require('../src/db');

(async () => {
  // Check stuck queued message for Marquis
  const { rows } = await query(
    "SELECT id, to_email, status, scheduled_for, created_at FROM messages WHERE status = 'queued' AND client_id = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937'"
  );
  console.log('Queued messages for Marquis:');
  rows.forEach(r => console.log(
    ` id=${r.id} to=${r.to_email} scheduled_for=${r.scheduled_for} created=${new Date(Number(r.created_at)).toISOString()}`
  ));

  // Check team@ user tokens for daily report
  const { rows: teamRows } = await query(
    "SELECT email, role, client_id, (google_refresh_token_encrypted IS NOT NULL) AS has_refresh, google_scope FROM users WHERE email = 'team@dmrmedia.org'"
  );
  console.log('\nteam@dmrmedia.org user rows:');
  teamRows.forEach(r => console.log(r));

  // Check last 3 days of messages sent — to see if daily report was sent
  const since3d = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const { rows: reportMsgs } = await query(
    "SELECT to_email, subject, sent_at, created_at FROM messages WHERE to_email = 'max@dmrmedia.org' AND direction = 'outbound' ORDER BY created_at DESC LIMIT 10"
  );
  console.log('\nRecent outbound to max@dmrmedia.org:');
  if (!reportMsgs.length) console.log('  (none)');
  reportMsgs.forEach(r => console.log(` "${r.subject}" created=${new Date(Number(r.created_at)).toISOString()}`));

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
