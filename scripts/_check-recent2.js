'use strict';
require('dotenv').config();
const { query } = require('../src/db');

const CLIENT = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';

async function run() {
  const convs = await query(
    'SELECT id, lead_email, lead_name, lead_type, source, created_at FROM conversations WHERE client_id = $1 ORDER BY created_at DESC LIMIT 8',
    [CLIENT]
  );
  console.log('\n=== Latest conversations ===');
  convs.rows.forEach(r => {
    const d = new Date(Number(r.created_at));
    console.log(`  [${r.id}] ${r.lead_type} | ${r.lead_email} | ${r.lead_name || '(no name)'} | ${r.source || ''} | ${d.toISOString()}`);
  });

  const msgs = await query(
    'SELECT id, status, from_email, to_email, sent_at, created_at FROM messages WHERE client_id = $1 ORDER BY created_at DESC LIMIT 5',
    [CLIENT]
  );
  console.log('\n=== Latest messages ===');
  msgs.rows.forEach(r => {
    const d = new Date(Number(r.created_at));
    console.log(`  msg#${r.id} [${r.status}] from=${r.from_email} to=${r.to_email} | ${d.toISOString()}`);
  });

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
