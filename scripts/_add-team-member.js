'use strict';
require('dotenv').config();
const { query } = require('../src/db');
const clientsRepo = require('../src/repos/clients');

async function run() {
  const email = process.argv[2];
  const clientSearch = process.argv[3] || 'marquis';

  if (!email) {
    console.error('Usage: node scripts/_add-team-member.js <email> [client-name-search]');
    process.exit(1);
  }

  const r = await query(
    'SELECT id, name, agent_email FROM clients WHERE LOWER(name) LIKE $1 LIMIT 5',
    [`%${clientSearch.toLowerCase()}%`]
  );

  if (!r.rows.length) {
    console.error(`No client found matching "${clientSearch}"`);
    process.exit(1);
  }

  const client = r.rows[0];
  console.log(`Found client: ${client.name} (${client.id})`);

  const user = await clientsRepo.upsertUser({
    email,
    name: null,
    clientId: client.id,
    role: 'member',
  });

  console.log(`Added user: ${user.email} (role=${user.role}) to ${client.name}`);

  const members = await clientsRepo.listUsersForClient(client.id);
  console.log('\nCurrent team:');
  members.forEach(m => console.log(`  ${m.role.padEnd(8)} ${m.email}  connected=${m.connected}`));

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
