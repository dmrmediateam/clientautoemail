'use strict';

const { initDb } = require('../src/db');
const clientsRepo = require('../src/repos/clients');

initDb();

const seeds = [
  {
    name: 'Marquis Farwell Homes',
    website: 'marquisfarwellhomes.com',
    agent_name: 'Marquis Farwell',
    agent_email: 'REPLACE_WITH_AGENT_EMAIL@marquisfarwellhomes.com',
    agent_phone: '',
    template_subject: 'Quick question about {{property_address}}',
    template_body: [
      'Hi {{first_name}},',
      '',
      'I saw you were checking out {{property_address}} — wanted to reach out personally and see if you had any questions, or if you\'d like to set up a private tour this week.',
      '',
      'What works best for you?',
      '',
      '{{agent_name}}',
      '{{agent_phone}}',
    ].join('\n'),
  },
  {
    name: 'CLIENT 2 — REPLACE',
    website: '',
    agent_name: 'REPLACE',
    agent_email: 'REPLACE@example.com',
    agent_phone: '',
    template_subject: 'Question about {{property_address}}',
    template_body: clientsRepo.defaultTemplateBody(),
  },
];

const existing = clientsRepo.findAll();
if (existing.length > 0) {
  console.log(`[seed] DB already has ${existing.length} client(s). Skipping seed. Use the admin UI or delete data/bridge.db to re-seed.`);
  process.exit(0);
}

for (const seed of seeds) {
  const c = clientsRepo.create(seed);
  console.log(`[seed] created ${c.name} → /admin/clients/${c.id}`);
  console.log(`        webhook: /v1/webhooks/incoming/${c.id}`);
}

console.log('\n[seed] done. Edit each client in the admin UI to set the correct agent email, then click "Connect Gmail".');
