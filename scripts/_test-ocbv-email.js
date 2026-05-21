'use strict';
require('dotenv').config();
const clientsRepo = require('../src/repos/clients');
const google = require('../src/services/google');

const FROM_EMAIL = 'max@dmrmedia.org';
const TO_EMAIL   = 'max@amarketology.com';
const DMR_CLIENT = '31114d89-ea43-434f-ae7e-9d19708ca054';

const SUBJECT = 'Following up - Ocean Breeze Villa, Turks & Caicos';

const BODY = `Hi Max,

Thank you for your interest in Ocean Breeze Villa — I wanted to personally follow up and see if you have any questions.

Ocean Breeze is a newly built 5-bedroom waterfront estate in Chalk Sound, Providenciales, offered at $6,500,000. The property sits on one of the most coveted stretches of coastline in the Caribbean and features:

  • Private overwater dock, pool & rooftop terrace
  • Panoramic 180° ocean views from every primary living space
  • Chef's kitchen, wine wall, sauna & smart lighting throughout
  • 6,000 sq ft interior | Built 2022
  • 5 min to Sapodilla Bay Beach · 15 min to Providenciales International Airport
  • 0% income, capital gains, or inheritance tax in Turks & Caicos
  • 94% average rental occupancy in the Chalk Sound luxury segment

I'd love to send over the full listing package and walk you through ownership details. Are you available for a quick call this week?

You can also explore the property at: https://www.oceanbreezevillatci.com/

Max De Leonardis
Ocean Breeze Villa
max@dmrmedia.org`;

(async () => {
  const teamUsers = await clientsRepo.listUsersForClient(DMR_CLIENT);
  const userRow   = teamUsers.find(u => u.email.toLowerCase() === FROM_EMAIL.toLowerCase());

  if (!userRow) {
    console.error(`ERROR: ${FROM_EMAIL} not found in DMR Media Team users. Run _fix-max-team.js first.`);
    process.exit(1);
  }
  if (!userRow.connected) {
    console.error(`ERROR: ${FROM_EMAIL} has no connected Gmail. Sign in via OAuth first.`);
    process.exit(1);
  }

  console.log(`Sending test email...`);
  console.log(`  From   : ${FROM_EMAIL}`);
  console.log(`  To     : ${TO_EMAIL}`);
  console.log(`  Subject: ${SUBJECT}`);

  const result = await google.sendAsUserRow(userRow, 'Max De Leonardis', {
    to: { email: TO_EMAIL, name: 'Max' },
    subject: SUBJECT,
    body: BODY,
  });

  console.log(`\nSent! Gmail message ID: ${result.messageId}`);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
