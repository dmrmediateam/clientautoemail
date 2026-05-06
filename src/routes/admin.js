'use strict';

const express = require('express');
const config = require('../config');
const clientsRepo = require('../repos/clients');
const leadsRepo = require('../repos/leads');
const dispatcher = require('../services/dispatcher');

const router = express.Router();

function flashFromQuery(req) {
  const q = req.query || {};
  if (q.connected) return { type: 'success', text: 'Google account connected.' };
  if (q.disconnected) return { type: 'info', text: 'Google account disconnected.' };
  if (q.created) return { type: 'success', text: 'Client created.' };
  if (q.updated) return { type: 'success', text: 'Client updated.' };
  if (q.deleted) return { type: 'info', text: 'Client deleted.' };
  if (q.tested === 'ok') return { type: 'success', text: 'Test email sent successfully.' };
  if (q.tested === 'fail') return { type: 'error', text: q.reason || 'Test email failed.' };
  return null;
}

router.get('/', async (req, res, next) => {
  try {
    const [clients, stats, recentLeads] = await Promise.all([
      clientsRepo.findAll(),
      leadsRepo.counts(),
      leadsRepo.recent(15),
    ]);
    res.render('dashboard', {
      page: 'dashboard',
      clients,
      stats,
      recentLeads,
      flash: flashFromQuery(req),
      publicBaseUrl: config.publicBaseUrl,
    });
  } catch (err) { next(err); }
});

router.get('/clients/new', (req, res) => {
  res.render('client_form', {
    page: 'clients',
    client: {
      name: '', website: '', agent_name: '', agent_email: '', agent_phone: '',
      template: { subject: 'Question about {{property_address}}', body: clientsRepo.defaultTemplateBody() },
      sendgrid_api_key: '',
    },
    isNew: true,
    flash: null,
    publicBaseUrl: config.publicBaseUrl,
  });
});

router.post('/clients', async (req, res, next) => {
  try {
    const b = req.body;
    const created = await clientsRepo.create({
      name: (b.name || '').trim(),
      website: (b.website || '').trim(),
      agent_name: (b.agent_name || '').trim(),
      agent_email: (b.agent_email || '').trim(),
      agent_phone: (b.agent_phone || '').trim(),
      sendgrid_api_key: (b.sendgrid_api_key || '').trim() || null,
      template_subject: (b.template_subject || '').trim(),
      template_body: b.template_body || '',
    });
    res.redirect(`/admin/clients/${created.id}?created=1`);
  } catch (err) { next(err); }
});

router.get('/clients/:id', async (req, res, next) => {
  try {
    const client = await clientsRepo.findById(req.params.id);
    if (!client) return res.status(404).send('Client not found');
    const recent = await leadsRepo.recentForClient(client.id, 25);
    res.render('client_detail', {
      page: 'clients',
      client,
      recent,
      flash: flashFromQuery(req),
      publicBaseUrl: config.publicBaseUrl,
    });
  } catch (err) { next(err); }
});

router.get('/clients/:id/edit', async (req, res, next) => {
  try {
    const client = await clientsRepo.findById(req.params.id);
    if (!client) return res.status(404).send('Client not found');
    res.render('client_form', {
      page: 'clients',
      client,
      isNew: false,
      flash: null,
      publicBaseUrl: config.publicBaseUrl,
    });
  } catch (err) { next(err); }
});

router.post('/clients/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const b = req.body;
    const patch = {
      name: b.name?.trim(),
      website: b.website?.trim(),
      agent_name: b.agent_name?.trim(),
      agent_email: b.agent_email?.trim(),
      agent_phone: b.agent_phone?.trim(),
      template_subject: b.template_subject?.trim(),
      template_body: b.template_body,
      active: b.active === 'on' || b.active === '1' || b.active === true,
    };
    if (b.sendgrid_api_key !== undefined) {
      patch.sendgrid_api_key = b.sendgrid_api_key.trim() || null;
    }
    await clientsRepo.update(id, patch);
    res.redirect(`/admin/clients/${id}?updated=1`);
  } catch (err) { next(err); }
});

router.post('/clients/:id/delete', async (req, res, next) => {
  try {
    await clientsRepo.remove(req.params.id);
    res.redirect('/admin?deleted=1');
  } catch (err) { next(err); }
});

router.post('/clients/:id/test', async (req, res, next) => {
  try {
    const client = await clientsRepo.findById(req.params.id);
    if (!client) return res.status(404).send('Client not found');
    const target = (req.body.to || client.agent_email || '').trim();
    if (!target) return res.redirect(`/admin/clients/${client.id}?tested=fail&reason=${encodeURIComponent('No target email')}`);

    const samplePayload = {
      name: 'Test Lead',
      email: target,
      phone: '555-555-0123',
      property_address: '123 Sample Drive, Beverly Hills, CA',
      property_url: 'https://example.com/listing/123',
      message: 'This is a test from the DMR Media bridge.',
      source: 'DMR Test',
    };
    const result = await dispatcher.processLead({ client, rawPayload: samplePayload });
    if (result.ok) {
      return res.redirect(`/admin/clients/${client.id}?tested=ok`);
    }
    return res.redirect(`/admin/clients/${client.id}?tested=fail&reason=${encodeURIComponent(result.reason || 'unknown')}`);
  } catch (err) { next(err); }
});

router.get('/leads', async (req, res, next) => {
  try {
    const recent = await leadsRepo.recent(100);
    res.render('leads', {
      page: 'leads',
      leads: recent,
      flash: null,
      publicBaseUrl: config.publicBaseUrl,
    });
  } catch (err) { next(err); }
});

module.exports = router;
