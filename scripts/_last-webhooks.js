'use strict';
require('dotenv').config();
const { query } = require('../src/db');

async function run() {
  const clientId = process.argv[2] || 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';
  const limit = parseInt(process.argv[3] || '3', 10);

  const r = await query(`
    SELECT m.id, m.status, m.to_email, m.subject, m.scheduled_for, m.sent_at, m.created_at, m.error,
           c.lead_name, c.lead_email, c.lead_type, c.property_address, c.source
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.client_id = $1
      AND m.direction = 'outbound'
    ORDER BY m.created_at DESC
    LIMIT $2
  `, [clientId, limit]);

  if (!r.rows.length) {
    console.log('No outbound messages found for this client.');
    process.exit(0);
  }

  const fmt = ms => ms ? new Date(Number(ms)).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'n/a';

  r.rows.forEach((row, i) => {
    console.log(`\n--- #${i + 1} ---`);
    console.log('Lead:      ', row.lead_name || '(no name)', '|', row.lead_email, '|', row.lead_type);
    console.log('Property:  ', row.property_address || 'n/a');
    console.log('Source:    ', row.source || 'n/a');
    console.log('Subject:   ', row.subject);
    console.log('Status:    ', row.status);
    console.log('Received:  ', fmt(row.created_at), 'CT');
    console.log('Scheduled: ', fmt(row.scheduled_for), 'CT');
    console.log('Sent:      ', fmt(row.sent_at), 'CT');
    if (row.error) console.log('Error:     ', row.error);
  });

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
