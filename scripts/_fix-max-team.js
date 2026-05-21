'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const DMR_CLIENT = '31114d89-ea43-434f-ae7e-9d19708ca054';

(async () => {
  // Check current state of max@
  const cur = await query("SELECT id, email, client_id, role FROM users WHERE email = 'max@dmrmedia.org'");
  console.log('Current max@ row:', cur.rows[0] || 'NOT FOUND');

  // Check if a client was auto-created for max@
  const newClient = await query("SELECT id, name, agent_email FROM clients WHERE LOWER(agent_email) = 'max@dmrmedia.org'");
  console.log('Auto-created client for max@:', newClient.rows[0] || 'none');

  // Reassign max@ to the DMR Media Team client
  const fix = await query(
    "UPDATE users SET client_id = $1, role = 'member', updated_at = $2 WHERE email = 'max@dmrmedia.org' RETURNING id, email, client_id, role",
    [DMR_CLIENT, Date.now()]
  );
  if (fix.rows[0]) {
    console.log('Reassigned:', fix.rows[0]);
  } else {
    // Not in users table yet — insert fresh
    const ins = await query(
      "INSERT INTO users (id, email, name, client_id, role, created_at, updated_at) VALUES (gen_random_uuid()::text, 'max@dmrmedia.org', 'Max', $1, 'member', $2, $2) ON CONFLICT (email) DO UPDATE SET client_id = $1, role = 'member', updated_at = $2 RETURNING *",
      [DMR_CLIENT, Date.now()]
    );
    console.log('Inserted/updated:', ins.rows[0]);
  }

  // Show final team
  const team = await query("SELECT email, role, google_connected FROM users WHERE client_id = $1 ORDER BY role DESC, created_at ASC", [DMR_CLIENT]);
  console.log('\nDMR Media Team members:');
  team.rows.forEach(r => console.log(' ', r.role.padEnd(8), r.email, ' connected=' + r.google_connected));

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
