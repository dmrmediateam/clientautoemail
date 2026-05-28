'use strict';
require('dotenv').config();
const { query } = require('../src/db');

(async () => {
  // Reset message 42 back to queued so send-queued will retry it
  const { rowCount } = await query(
    `UPDATE messages
     SET status = 'queued', error = NULL, scheduled_for = $1
     WHERE id = 42 AND status = 'failed'`,
    [Date.now()]
  );
  if (rowCount === 0) {
    console.log('Message 42 not found or not in failed state');
  } else {
    console.log('Message 42 re-queued for retry');
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
