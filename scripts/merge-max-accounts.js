'use strict';
/**
 * Merge Max ATX (7eb429ce) into Max De Leonardis (dfa8056c).
 * Max ATX has 0 conversations. producer1564@gmail.com is already a user
 * under Max De Leonardis. Safe to delete the ATX client row.
 */
require('dotenv').config();
const { query } = require('../src/db');

const ATX = '7eb429ce-a34c-494e-ab86-8291c32710e9';
const DL  = 'dfa8056c-38c9-4903-ae37-37d1a2015910';
const DRY = process.argv.includes('--dry-run');
if (DRY) console.log('[merge] DRY RUN\n');

async function main() {
  // Safety checks
  const { rows: [atx] } = await query('SELECT id,name FROM clients WHERE id=$1', [ATX]);
  if (!atx) { console.log('Max ATX not found — already deleted?'); process.exit(0); }

  const { rows: [dl] } = await query('SELECT id,name FROM clients WHERE id=$1', [DL]);
  if (!dl) { console.error('Max De Leonardis not found!'); process.exit(1); }

  const { rows: [{ count }] } = await query('SELECT COUNT(*) FROM conversations WHERE client_id=$1', [ATX]);
  if (Number(count) > 0) {
    console.error(`ABORT: Max ATX has ${count} conversations — manual review needed`);
    process.exit(1);
  }

  console.log(`Will delete: ${atx.name} (${ATX})`);
  console.log(`Keeping:     ${dl.name} (${DL})`);
  console.log('ATX conversations: 0 — safe to delete');

  if (DRY) { console.log('\n[dry-run] No changes made.'); process.exit(0); }

  // Delete in order: client_settings first (FK), then the client row
  const s = await query('DELETE FROM client_settings WHERE client_id=$1', [ATX]);
  console.log(`Deleted ${s.rowCount} client_settings row(s)`);

  // Delete any users rows for ATX (there are none per check, but be safe)
  const u = await query('DELETE FROM users WHERE client_id=$1', [ATX]);
  console.log(`Deleted ${u.rowCount} users row(s)`);

  const c = await query('DELETE FROM clients WHERE id=$1', [ATX]);
  console.log(`Deleted ${c.rowCount} clients row(s)`);

  console.log('\n[merge] Done. Max ATX removed. Max De Leonardis is the single account.');
  process.exit(0);
}
main().catch(e => { console.error('[merge] Error:', e.message); process.exit(1); });
