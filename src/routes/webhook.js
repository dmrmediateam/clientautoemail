'use strict';

const express = require('express');
const clientsRepo = require('../repos/clients');
const dispatcher = require('../services/dispatcher');

const router = express.Router();

router.post('/incoming/:client_uuid', (req, res) => {
  const clientUuid = req.params.client_uuid;
  const client = clientsRepo.findById(clientUuid);

  if (!client) {
    return res.status(404).json({ error: 'unknown_client' });
  }
  if (!client.active) {
    return res.status(403).json({ error: 'client_inactive' });
  }

  const payload = req.body && typeof req.body === 'object' ? req.body : {};

  res.status(200).json({ ok: true, accepted: true });

  setImmediate(async () => {
    try {
      const result = await dispatcher.processLead({ client, rawPayload: payload });
      console.log(`[webhook] client=${client.id} result=${JSON.stringify(result)}`);
    } catch (err) {
      console.error(`[webhook] client=${client.id} unhandled error:`, err);
    }
  });
});

router.get('/incoming/:client_uuid/health', (req, res) => {
  const client = clientsRepo.findById(req.params.client_uuid);
  if (!client) return res.status(404).json({ error: 'unknown_client' });
  res.json({
    ok: true,
    client: client.name,
    google_connected: client.google.connected,
    active: client.active,
  });
});

module.exports = router;
