'use strict';

const { initDb, close } = require('../src/db');
const clientsRepo = require('../src/repos/clients');
const conversationsRepo = require('../src/repos/conversations');
const { query } = require('../src/db');

async function seedClientSettings() {
  const clients = await clientsRepo.findAll();
  for (const client of clients) {
    await clientsRepo.upsertSettings(client.id, {
      buyer_template_subject: client.template.subject,
      buyer_template_body: client.template.body,
      seller_template_subject: client.settings?.seller_template_subject || client.template.subject,
      seller_template_body: client.settings?.seller_template_body || client.template.body,
      send_window_start: client.settings?.send_window_start || '08:30',
      send_window_end: client.settings?.send_window_end || '18:00',
      timezone: client.settings?.timezone || 'America/Chicago',
      daily_send_limit: client.settings?.daily_send_limit || 5,
    });
  }
}

async function backfillLeadsToConversations() {
  const r = await query(
    `SELECT *
     FROM leads
     ORDER BY created_at ASC`
  );
  for (const lead of r.rows) {
    await conversationsRepo.findOrCreateForLead({
      client_id: lead.client_id,
      lead_email: lead.email_to || `unknown+${lead.id}@unknown.invalid`,
      lead_name: '',
      lead_phone: '',
      lead_type: 'buyer',
      property_address: '',
      source: 'legacy',
    });
  }
}

(async () => {
  try {
    await initDb();
    await seedClientSettings();
    await backfillLeadsToConversations();
    console.log('[migrate-v2] schema applied and v2 defaults/backfill complete.');
  } catch (err) {
    console.error('[migrate-v2] failed:', err);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();
