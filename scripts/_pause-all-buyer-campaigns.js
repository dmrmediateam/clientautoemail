'use strict';
// One-time migration: set buyer_paused = true for all clients that currently
// have buyer_paused = false.  Seller campaigns are left untouched.
require('dotenv').config();
const { query } = require('../src/db');

(async () => {
  const before = await query(
    `SELECT c.id, c.name, cs.buyer_paused, cs.seller_paused
     FROM clients c
     LEFT JOIN client_settings cs ON cs.client_id = c.id
     ORDER BY c.name`
  );

  console.log('\n── Current state ────────────────────────────────────');
  for (const r of before.rows) {
    const bp = r.buyer_paused == null ? '(no row)' : r.buyer_paused ? 'PAUSED' : 'ACTIVE';
    const sp = r.seller_paused == null ? '(no row)' : r.seller_paused ? 'PAUSED' : 'ACTIVE';
    console.log(`  ${r.name.padEnd(40)} buyer=${bp.padEnd(8)} seller=${sp}`);
  }

  const r = await query(
    `UPDATE client_settings
     SET buyer_paused = true, updated_at = $1
     WHERE buyer_paused = false
     RETURNING client_id`,
    [Date.now()]
  );
  console.log(`\n✅ Updated ${r.rowCount} client_settings row(s) — buyer_paused → true`);

  const after = await query(
    `SELECT c.id, c.name, cs.buyer_paused, cs.seller_paused
     FROM clients c
     LEFT JOIN client_settings cs ON cs.client_id = c.id
     ORDER BY c.name`
  );

  console.log('\n── After migration ──────────────────────────────────');
  for (const r of after.rows) {
    const bp = r.buyer_paused == null ? '(no row)' : r.buyer_paused ? 'PAUSED' : 'ACTIVE';
    const sp = r.seller_paused == null ? '(no row)' : r.seller_paused ? 'PAUSED' : 'ACTIVE';
    console.log(`  ${r.name.padEnd(40)} buyer=${bp.padEnd(8)} seller=${sp}`);
  }

  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
