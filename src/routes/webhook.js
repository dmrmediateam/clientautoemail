'use strict';

const express = require('express');
const clientsRepo = require('../repos/clients');
const dispatcher = require('../services/dispatcher');
const conversationsRepo = require('../repos/conversations');
const messagesRepo = require('../repos/messages');
const google = require('../services/google');

const router = express.Router();

router.post('/incoming/:client_uuid', async (req, res) => {
  const clientUuid = req.params.client_uuid;
  let client;
  try {
    client = await clientsRepo.findById(clientUuid);
  } catch (err) {
    console.error(`[webhook] lookup failed for ${clientUuid}:`, err);
    return res.status(500).json({ error: 'lookup_failed' });
  }

  if (!client) return res.status(404).json({ error: 'unknown_client' });
  if (!client.active) return res.status(403).json({ error: 'client_inactive' });

  const payload = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    const result = await dispatcher.processLead({ client, rawPayload: payload });
    console.log(`[webhook] client=${client.id} result=${JSON.stringify(result)}`);
    if (result.ok) {
      return res.status(200).json({ ok: true, accepted: true, message_id: result.messageId });
    }
    return res.status(200).json({ ok: false, accepted: true, reason: result.reason });
  } catch (err) {
    console.error(`[webhook] client=${client.id} unhandled error:`, err);
    return res.status(500).json({ ok: false, error: 'dispatch_failed' });
  }
});

router.get('/incoming/:client_uuid/health', async (req, res) => {
  try {
    const client = await clientsRepo.findById(req.params.client_uuid);
    if (!client) return res.status(404).json({ error: 'unknown_client' });
    res.json({
      ok: true,
      client: client.name,
      google_connected: client.google.connected,
      active: client.active,
    });
  } catch (err) {
    console.error('[webhook health] error:', err);
    res.status(500).json({ error: 'health_failed' });
  }
});

router.post('/gmail/push', async (req, res) => {
  try {
    const token = process.env.GMAIL_PUSH_VERIFICATION_TOKEN || '';
    if (token && req.query.token !== token) {
      return res.status(401).json({ ok: false, error: 'invalid_token' });
    }
    const pubsubMessage = req.body?.message?.data;
    if (!pubsubMessage) return res.status(200).json({ ok: true, ignored: true });
    const decoded = JSON.parse(Buffer.from(pubsubMessage, 'base64').toString('utf8'));
    const emailAddress = decoded.emailAddress || '';
    if (!emailAddress) return res.status(200).json({ ok: true, ignored: true });

    const client = await clientsRepo.findByGoogleEmail(emailAddress);
    if (!client) return res.status(200).json({ ok: true, ignored: true });

    const inbound = await google.listInboundMessages(client, 15);
    let inserted = 0;
    for (const msg of inbound) {
      const exists = await messagesRepo.findByGmailMessageId(msg.gmail_message_id);
      if (exists) continue;
      const conv = await conversationsRepo.findOrCreateForLead({
        client_id: client.id,
        lead_email: msg.from_email || 'unknown@unknown.invalid',
        lead_name: '',
        lead_phone: '',
        lead_type: 'buyer',
        property_address: '',
        source: 'gmail',
        thread_id: msg.gmail_thread_id || '',
      });
      await messagesRepo.create({
        conversation_id: conv.id,
        client_id: client.id,
        direction: 'inbound',
        from_email: msg.from_email,
        to_email: msg.to_email,
        subject: msg.subject,
        body: msg.body,
        status: 'received',
        gmail_message_id: msg.gmail_message_id,
        gmail_thread_id: msg.gmail_thread_id,
        internet_message_id: msg.internet_message_id,
      });
      inserted += 1;
    }
    return res.status(200).json({ ok: true, inserted });
  } catch (err) {
    console.error('[gmail push] failed:', err);
    return res.status(200).json({ ok: true, ignored: true });
  }
});

module.exports = router;
