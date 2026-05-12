'use strict';

const conversationsRepo = require('../repos/conversations');
const messagesRepo = require('../repos/messages');
const tpl = require('./template');
const { normalize, shouldSkip, shouldSkipRaw } = require('./leadNormalizer');
const { nextWindowStart } = require('./scheduler');

async function processLead({ client, rawPayload }) {
  const lead = normalize(rawPayload);

  // Silently skip lead sources that should not receive automated emails.
  if (shouldSkipRaw(rawPayload) || shouldSkip(lead)) {
    console.log(`[dispatcher] skipping lead source "${lead._lp_lead_source || lead.source}" for client ${client.id}`);
    return { ok: false, reason: 'skipped_source', source: lead._lp_lead_source || lead.source };
  }

  // Per-client campaign pause flags.
  const settings = client.settings || {};
  if (lead.lead_type === 'buyer' && settings.buyer_paused) {
    console.log(`[dispatcher] buyer campaign paused for client ${client.id}`);
    return { ok: false, reason: 'campaign_paused', lead_type: 'buyer' };
  }
  if (lead.lead_type === 'seller' && settings.seller_paused) {
    console.log(`[dispatcher] seller campaign paused for client ${client.id}`);
    return { ok: false, reason: 'campaign_paused', lead_type: 'seller' };
  }

  const data = {
    ...lead,
    agent_name: client.agent_name,
    agent_email: client.agent_email,
    agent_phone: client.agent_phone,
    client_name: client.name,
    client_website: client.website,
  };

  const template = lead.lead_type === 'seller'
    ? client.templates?.seller || client.template
    : client.templates?.buyer || client.template;
  const subject = tpl.render(template.subject, data);
  let body = tpl.render(template.body, data);
  if (settings.team_signature_enabled) {
    body = body.trimEnd() + `\n${client.name} Team`;
  }
  const fromEmail = client.google.email || client.agent_email;

  const conversation = await conversationsRepo.findOrCreateForLead({
    client_id: client.id,
    lead_email: lead.email || `unknown+${Date.now()}@unknown.invalid`,
    lead_name: lead.full_name,
    lead_phone: lead.phone,
    lead_type: lead.lead_type,
    property_address: lead.property_address,
    source: lead.source,
  });

  if (!lead.email) {
    await messagesRepo.create({
      conversation_id: conversation.id,
      client_id: client.id,
      direction: 'outbound',
      from_email: fromEmail,
      to_email: '',
      subject,
      body,
      status: 'failed',
      error: 'No lead email in payload',
      raw_payload: rawPayload,
    });
    return { ok: false, reason: 'no_lead_email' };
  }

  if (!client.google.connected) {
    await messagesRepo.create({
      conversation_id: conversation.id,
      client_id: client.id,
      direction: 'outbound',
      from_email: fromEmail,
      to_email: lead.email,
      subject,
      body,
      status: 'failed',
      error: 'Client has not connected Gmail',
      raw_payload: rawPayload,
    });
    return { ok: false, reason: 'gmail_not_connected' };
  }

  const sendWindow = {
    sendWindowStart: settings.send_window_start || '08:30',
    sendWindowEnd: settings.send_window_end || '18:00',
    timezone: settings.timezone || 'America/Chicago',
  };
  const scheduledFor = nextWindowStart({
    nowMs: Date.now(),
    ...sendWindow,
    forceNextDay: false,
  });

  const ccEmail = client.settings?.cc_email || '';
  const message = await messagesRepo.create({
    conversation_id: conversation.id,
    client_id: client.id,
    direction: 'outbound',
    from_email: fromEmail,
    to_email: lead.email,
    subject,
    body,
    status: 'pending',
    scheduled_for: scheduledFor,
    raw_payload: rawPayload,
  });

  return {
    ok: true,
    accepted: true,
    queued: true,
    messageId: message.id,
    conversationId: conversation.id,
    scheduledFor,
    leadType: lead.lead_type,
  };
}

async function queueReply({ client, conversation, body }) {
  const subject = conversation.last_subject || `Re: ${conversation.property_address || 'Your inquiry'}`;
  return messagesRepo.create({
    conversation_id: conversation.id,
    client_id: client.id,
    direction: 'outbound',
    from_email: client.google.email || client.agent_email,
    to_email: conversation.lead_email,
    subject,
    body,
    status: 'queued',
    scheduled_for: Date.now(),
  });
}

module.exports = { processLead, queueReply };
