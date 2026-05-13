'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const CLIENT = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';

async function run() {
  // Restore Linda as CC
  await query(
    `UPDATE client_settings SET cc_email = $1, updated_at = $2 WHERE client_id = $3`,
    ['linda.farwell@compass.com', Date.now(), CLIENT]
  );
  console.log('CC restored: linda.farwell@compass.com');

  // Confirm settings
  const s = await query(
    'SELECT cc_email, send_from_email, seller_sender_email FROM client_settings WHERE client_id = $1',
    [CLIENT]
  );
  console.log('Settings now:', s.rows[0]);

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
