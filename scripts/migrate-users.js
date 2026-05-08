'use strict';
/**
 * migrate-users.js
 * Creates the `users` table and backfills existing clients.
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   node scripts/migrate-users.js
 *
 * To add a team member to an existing client after the fact:
 *   node scripts/migrate-users.js --add-member email@example.com <client_id>
 */

require('dotenv').config();
const { query } = require('../src/db');

async function run() {
  const args = process.argv.slice(2);

  // --- One-off: add a member user ---
  if (args[0] === '--add-member') {
    const email = args[1];
    const clientId = args[2];
    if (!email || !clientId) {
      console.error('Usage: node scripts/migrate-users.js --add-member <email> <client_id>');
      process.exit(1);
    }
    const t = Date.now();
    await query(
      `INSERT INTO users (id, email, name, client_id, role, created_at, updated_at)
       VALUES (gen_random_uuid()::text, LOWER($1), NULL, $2, 'member', $3, $3)
       ON CONFLICT (email) DO UPDATE SET client_id = $2, role = 'member', updated_at = $3`,
      [email, clientId, t]
    );
    console.log(`Added member: ${email} → client ${clientId}`);
    process.exit(0);
  }

  // --- 1. Create users table (with Google token columns for per-user sending) ---
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id                              TEXT PRIMARY KEY,
      email                           TEXT UNIQUE NOT NULL,
      name                            TEXT,
      client_id                       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      role                            TEXT NOT NULL DEFAULT 'member',
      google_connected                BOOLEAN NOT NULL DEFAULT FALSE,
      google_access_token_encrypted   TEXT,
      google_refresh_token_encrypted  TEXT,
      google_token_expiry             BIGINT,
      google_scope                    TEXT,
      created_at                      BIGINT NOT NULL,
      updated_at                      BIGINT NOT NULL
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id)`);

  // Add token columns if table already existed without them (idempotent)
  const tokenCols = [
    'google_connected BOOLEAN NOT NULL DEFAULT FALSE',
    'google_access_token_encrypted TEXT',
    'google_refresh_token_encrypted TEXT',
    'google_token_expiry BIGINT',
    'google_scope TEXT',
  ];
  for (const col of tokenCols) {
    const colName = col.split(' ')[0];
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col}`).catch(() => {});
    console.log(`  ✓ users.${colName}`);
  }

  // --- 2. Add send_from_email to client_settings if missing ---
  await query(`ALTER TABLE client_settings ADD COLUMN IF NOT EXISTS send_from_email TEXT NOT NULL DEFAULT ''`).catch(() => {});
  console.log('✓ client_settings.send_from_email');
  console.log('✓ users table ready');

  // --- 2. Backfill owners from agent_email ---
  const { rows: clients } = await query('SELECT id, agent_name, agent_email FROM clients');
  for (const c of clients) {
    const email = c.agent_email.toLowerCase();
    const t = Date.now();
    const r = await query(
      `INSERT INTO users (id, email, name, client_id, role, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'owner', $4, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING email`,
      [email, c.agent_name, c.id, t]
    );
    if (r.rows[0]) console.log(`  backfilled owner: ${email} → ${c.id}`);
    else console.log(`  already exists:  ${email}`);
  }

  // --- 3. Backfill owners from google_email (if different from agent_email) ---
  const { rows: gRows } = await query(
    `SELECT id, google_email FROM clients
     WHERE google_email IS NOT NULL AND google_email <> ''
       AND LOWER(google_email) <> LOWER(agent_email)`
  );
  for (const c of gRows) {
    const email = c.google_email.toLowerCase();
    const t = Date.now();
    const r = await query(
      `INSERT INTO users (id, email, name, client_id, role, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, NULL, $2, 'owner', $3, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING email`,
      [email, c.id, t]
    );
    if (r.rows[0]) console.log(`  backfilled google_email owner: ${email} → ${c.id}`);
  }

  console.log('\nDone. Run with --add-member to add team members.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
