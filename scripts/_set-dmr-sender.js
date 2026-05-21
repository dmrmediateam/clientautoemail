'use strict';
// Sets send_from_email = max@dmrmedia.org on the DMR Media Team client
// so all OCBV (and future DMR) outbound emails send from max's Gmail account.
require('dotenv').config();
const { query } = require('../src/db');
const clientsRepo = require('../src/repos/clients');
const clientSettingsRepo = require('../src/repos/clientSettings');

(async () => {
  const { rows } = await query(
    `SELECT client_id FROM users WHERE email = 'max@dmrmedia.org' LIMIT 1`
  );
  const clientId = rows[0]?.client_id;
  if (!clientId) throw new Error('max@dmrmedia.org user not found');

  // Load current settings and patch only send_from_email
  const current = await clientSettingsRepo.findByClientId(clientId);
  const updated = { ...(current || clientSettingsRepo.defaultSettings()), send_from_email: 'max@dmrmedia.org' };
  await clientSettingsRepo.upsert(clientId, updated);

  console.log(`Done — send_from_email = max@dmrmedia.org on client ${clientId}`);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
