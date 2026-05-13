'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const CLIENT_ID = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';
const SENDER    = 'samantha.marquis@compass.com';

async function run() {
  // 1. Set send_from_email to Samantha's connected Gmail
  await query(
    'UPDATE client_settings SET send_from_email = $1, updated_at = $2 WHERE client_id = $3',
    [SENDER, Date.now(), CLIENT_ID]
  );
  console.log(`send_from_email set to: ${SENDER}`);

  // 2. Re-queue recently failed messages so cron will retry
  const r = await query(
    "UPDATE messages SET status = 'queued', error = NULL WHERE client_id = $1 AND status = 'failed' RETURNING id, to_email",
    [CLIENT_ID]
  );
  console.log(`Re-queued ${r.rowCount} messages:`);
  r.rows.forEach(x => console.log(`  #${x.id} → ${x.to_email}`));

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
