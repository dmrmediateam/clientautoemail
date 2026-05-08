'use strict';
/**
 * migrate-sender-routing.js
 * Adds buyer_sender_email and seller_sender_email columns to client_settings.
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   node scripts/migrate-sender-routing.js
 *   node scripts/migrate-sender-routing.js --set-buyer clientId email
 *   node scripts/migrate-sender-routing.js --set-seller clientId email
 */

const { initDb, close, query } = require('../src/db');

async function migrate() {
  await query(`
    ALTER TABLE client_settings
    ADD COLUMN IF NOT EXISTS buyer_sender_email TEXT NOT NULL DEFAULT ''
  `);
  await query(`
    ALTER TABLE client_settings
    ADD COLUMN IF NOT EXISTS seller_sender_email TEXT NOT NULL DEFAULT ''
  `);
  console.log('[migrate-sender-routing] buyer_sender_email + seller_sender_email columns ready.');
}

async function setSender(clientId, column, email) {
  const r = await query(
    `UPDATE client_settings SET ${column} = $1 WHERE client_id = $2 RETURNING client_id`,
    [email.toLowerCase(), clientId]
  );
  if (r.rowCount === 0) {
    console.error(`No settings row found for client ${clientId}. Run after migration.`);
  } else {
    console.log(`[migrate-sender-routing] ${column} = ${email} for client ${clientId}`);
  }
}

(async () => {
  try {
    await initDb();
    const args = process.argv.slice(2);
    if (args[0] === '--set-buyer' && args[1] && args[2]) {
      await migrate();
      await setSender(args[1], 'buyer_sender_email', args[2]);
    } else if (args[0] === '--set-seller' && args[1] && args[2]) {
      await migrate();
      await setSender(args[1], 'seller_sender_email', args[2]);
    } else {
      await migrate();
    }
  } catch (err) {
    console.error('[migrate-sender-routing] failed:', err);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();
