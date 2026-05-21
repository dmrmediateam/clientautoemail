'use strict';
require('dotenv').config();
const { query } = require('../src/db');

(async () => {
  await query(
    `UPDATE messages SET status='failed', error=$1 WHERE id=42`,
    ['invalid_grant: samantha.marquis@compass.com Google token revoked — reconnect required']
  );
  console.log('Message 42 marked failed.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
