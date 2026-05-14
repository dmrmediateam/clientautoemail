'use strict';
/**
 * Migration: allow admin users (team@) to have NULL client_id in the users table.
 * Also ensures the team@ admin user row exists so the daily-report cron can send email.
 *
 * Run once:  node scripts/_fix-admin-user.js
 */

require('dotenv').config();
const { query } = require('../src/db');

(async () => {
  // 1. Drop NOT NULL constraint on users.client_id
  await query(`ALTER TABLE users ALTER COLUMN client_id DROP NOT NULL`).catch(err => {
    if (err.message.includes('already nullable') || err.message.includes('does not exist')) {
      console.log('  users.client_id already nullable — skipping');
    } else {
      throw err;
    }
  });
  console.log('✓ users.client_id is now nullable');

  // 2. Ensure the google token columns exist (idempotent, from migrate-users.js)
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

  // 3. Upsert the admin user row (no client_id)
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'team@dmrmedia.org';
  const t = Date.now();
  const { rows } = await query(
    `INSERT INTO users (id, email, name, client_id, role, created_at, updated_at)
     VALUES (gen_random_uuid()::text, LOWER($1), $2, NULL, 'admin', $3, $3)
     ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name), updated_at = $3
     RETURNING email, role`,
    [adminEmail, 'DMR Media Team', t]
  );
  console.log(`✓ admin user row: ${rows[0].email} (${rows[0].role})`);
  console.log('');
  console.log('Done. Now reconnect via /auth/google/start to save fresh OAuth tokens.');
  process.exit(0);
})().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
