'use strict';
require('dotenv').config();
const { query } = require('../src/db');

async function run() {
  // Show all users with null names
  const r = await query('SELECT id, email, name FROM users ORDER BY created_at');
  console.log('All users:');
  r.rows.forEach(u => console.log(' ', u.name ? `[OK] ${u.email} → "${u.name}"` : `[NULL] ${u.email}`));

  // Backfill null names from email prefix (capitalize each word)
  const nulls = r.rows.filter(u => !u.name);
  for (const u of nulls) {
    const derived = u.email.split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    await query('UPDATE users SET name = $1 WHERE id = $2', [derived, u.id]);
    console.log(`  Set "${u.email}" → "${derived}"`);
  }

  if (!nulls.length) console.log('No null names to fix.');
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
