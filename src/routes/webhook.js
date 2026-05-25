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

module.exports = router;
