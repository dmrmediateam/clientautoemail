'use strict';

const leadsRepo = require('../repos/leads');
const tpl = require('./template');
const google = require('./google');
const { normalize } = require('./leadNormalizer');

async function processLead({ client, rawPayload }) {
  const lead = normalize(rawPayload);

  const data = {
    ...lead,
    agent_name: client.agent_name,
    agent_email: client.agent_email,
    agent_phone: client.agent_phone,
    client_name: client.name,
    client_website: client.website,
  };

  const subject = tpl.render(client.template.subject, data);
  const body = tpl.render(client.template.body, data);

  if (!lead.email) {
    leadsRepo.record({
      client_id: client.id,
      raw_payload: rawPayload,
      normalized_payload: lead,
      email_to: '',
      email_from: client.google.email || client.agent_email,
      subject,
      body,
      status: 'failed',
      error: 'No lead email in payload',
    });
    return { ok: false, reason: 'no_lead_email' };
  }

  if (!client.google.connected) {
    leadsRepo.record({
      client_id: client.id,
      raw_payload: rawPayload,
      normalized_payload: lead,
      email_to: lead.email,
      email_from: client.agent_email,
      subject,
      body,
      status: 'failed',
      error: 'Client has not connected Gmail',
    });
    return { ok: false, reason: 'gmail_not_connected' };
  }

  try {
    const result = await google.sendAsClient(client, {
      to: { email: lead.email, name: lead.full_name },
      subject,
      body,
    });
    leadsRepo.record({
      client_id: client.id,
      raw_payload: rawPayload,
      normalized_payload: lead,
      email_to: lead.email,
      email_from: client.google.email || client.agent_email,
      subject,
      body,
      status: 'sent',
      message_id: result.messageId,
    });
    return { ok: true, messageId: result.messageId, threadId: result.threadId };
  } catch (err) {
    leadsRepo.record({
      client_id: client.id,
      raw_payload: rawPayload,
      normalized_payload: lead,
      email_to: lead.email,
      email_from: client.google.email || client.agent_email,
      subject,
      body,
      status: 'failed',
      error: err.code ? `${err.code}: ${err.message}` : (err.message || String(err)),
    });
    return { ok: false, reason: err.code || 'gmail_send_error', error: err.message };
  }
}

module.exports = { processLead };
