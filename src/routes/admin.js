'use strict';

const express = require('express');
const config = require('../config');
const clientsRepo = require('../repos/clients');
const leadsRepo = require('../repos/leads');
const conversationsRepo = require('../repos/conversations');
const dispatcher = require('../services/dispatcher');
const { issueClientSession, clearClientSession } = require('../middleware/auth');

const router = express.Router();

function flashFromQuery(req) {
  const q = req.query || {};
  if (q.connected) return { type: 'success', text: 'Google account connected.' };
  if (q.disconnected) return { type: 'info', text: 'Google account disconnected.' };
  if (q.created) return { type: 'success', text: 'Client created.' };
  if (q.updated) return { type: 'success', text: 'Client updated.' };
  if (q.deleted) return { type: 'info', text: 'Client deleted.' };
  if (q.paused) return { type: 'info', text: 'Automated responses paused.' };
  if (q.resumed) return { type: 'success', text: 'Automated responses resumed.' };
  if (q.tested === 'ok') return { type: 'success', text: 'Test email sent successfully.' };
  if (q.tested === 'fail') return { type: 'error', text: q.reason || 'Test email failed.' };
  return null;
}

router.get('/', async (req, res, next) => {
  try {
    const [clients, stats, recentLeads] = await Promise.all([
      clientsRepo.findAll(),
      leadsRepo.counts(),
      leadsRepo.recent(20),
    ]);
    // Attach per-client stats and member counts
    const [clientStatsRows, memberCounts] = await Promise.all([
      Promise.all(clients.map(c => leadsRepo.counts(c.id).catch(() => ({})))),
      Promise.all(clients.map(c => clientsRepo.listUsersForClient(c.id).then(u => u.length).catch(() => 0))),
    ]);
    const clientsWithStats = clients.map((c, i) => ({
      ...c,
      _stats: clientStatsRows[i] || {},
      _memberCount: memberCounts[i] || 0,
    }));
    res.render('dashboard', {
      page: 'dashboard',
      clients: clientsWithStats,
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
      templates: { buyer: { subject: 'Question about {{property_address}}', body: clientsRepo.defaultTemplateBody() }, seller: { subject: 'Question about your home at {{property_address}}', body: clientsRepo.defaultTemplateBody() } },
      settings: {},
      sendgrid_api_key: '',
    },
    teamMembers: [],
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
    const [recent, conversations, teamMembers] = await Promise.all([
      leadsRepo.recentForClient(client.id, 25),
      conversationsRepo.listWithPreview(client.id, 50),
      clientsRepo.listUsersForClient(client.id),
    ]);
    res.render('client_detail', {
      page: 'clients',
      client,
      recent,
      conversations,
      teamMembers,
      flash: flashFromQuery(req),
      publicBaseUrl: config.publicBaseUrl,
    });
  } catch (err) { next(err); }
});

router.get('/clients/:id/edit', async (req, res, next) => {
  try {
    const [client, teamMembers] = await Promise.all([
      clientsRepo.findById(req.params.id),
      clientsRepo.listUsersForClient(req.params.id),
    ]);
    if (!client) return res.status(404).send('Client not found');
    res.render('client_form', {
      page: 'clients',
      client,
      teamMembers,
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
      template_subject: (b.buyer_template_subject || b.template_subject || '').trim() || undefined,
      template_body: b.buyer_template_body || b.template_body || undefined,
      seller_template_subject: b.seller_template_subject?.trim() || undefined,
      seller_template_body: b.seller_template_body || undefined,
      send_window_start: b.send_window_start?.trim() || undefined,
      send_window_end: b.send_window_end?.trim() || undefined,
      timezone: b.timezone?.trim() || undefined,
      daily_send_limit: b.daily_send_limit ? Number(b.daily_send_limit) : undefined,
      cc_email: b.cc_email !== undefined ? (b.cc_email.trim() || '') : undefined,
      send_from_email: b.send_from_email !== undefined ? (b.send_from_email.trim().toLowerCase() || '') : undefined,
      buyer_sender_email: b.buyer_sender_email !== undefined ? (b.buyer_sender_email.trim().toLowerCase() || '') : undefined,
      seller_sender_email: b.seller_sender_email !== undefined ? (b.seller_sender_email.trim().toLowerCase() || '') : undefined,
      team_signature_enabled: b.team_signature_enabled === 'on' || b.team_signature_enabled === '1',
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

router.post('/clients/:id/pause', async (req, res, next) => {
  try {
    await clientsRepo.update(req.params.id, { active: false });
    res.redirect(`/admin/clients/${req.params.id}?paused=1`);
  } catch (err) { next(err); }
});

router.post('/clients/:id/resume', async (req, res, next) => {
  try {
    await clientsRepo.update(req.params.id, { active: true });
    res.redirect(`/admin/clients/${req.params.id}?resumed=1`);
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
    const { type, team, q } = req.query;
    const clients = await clientsRepo.findAll();
    const conversations = await conversationsRepo.listAll({
      clientId: team || undefined,
      leadType: type || undefined,
      search: q || undefined,
      limit: 200,
    });
    res.render('leads', {
      page: 'leads',
      clients,
      conversations,
      filters: { type: type || '', team: team || '', q: q || '' },
      flash: null,
      publicBaseUrl: config.publicBaseUrl,
    });
  } catch (err) { next(err); }
});

// Open a conversation from admin — issues client session then redirects to conversation view
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await conversationsRepo.findById(req.params.id);
    if (!conversation) return res.status(404).send('Conversation not found');
    const client = await clientsRepo.findById(conversation.client_id);
    if (!client) return res.status(404).send('Client not found');
    const ownerEmail = client.google.email || config.admin.superAdminEmail;
    issueClientSession(res, client.id, ownerEmail);
    res.redirect(`/dashboard/conversations/${conversation.id}`);
  } catch (err) { next(err); }
});

// Pause auto-responses for a client
router.post('/clients/:id/pause', async (req, res, next) => {
  try {
    await clientsRepo.update(req.params.id, { active: false });
    res.redirect(`/admin/clients/${req.params.id}?updated=1`);
  } catch (err) { next(err); }
});

// Resume auto-responses for a client
router.post('/clients/:id/resume', async (req, res, next) => {
  try {
    await clientsRepo.update(req.params.id, { active: true });
    res.redirect(`/admin/clients/${req.params.id}?updated=1`);
  } catch (err) { next(err); }
});

// Quick toggle active from dashboard (returns to dashboard)
router.post('/clients/:id/toggle-active', async (req, res, next) => {
  try {
    const client = await clientsRepo.findById(req.params.id);
    if (!client) return res.status(404).send('Client not found');
    await clientsRepo.update(req.params.id, { active: !client.active });
    res.redirect('/admin');
  } catch (err) { next(err); }
});

// Impersonate a client — issues a client session and redirects to their dashboard
// Optional ?redirect= query param to land on a specific page (e.g. /dashboard/template)
router.post('/clients/:id/impersonate', async (req, res, next) => {
  try {
    const client = await clientsRepo.findById(req.params.id);
    if (!client) return res.status(404).send('Client not found');
    // Issue session using the client owner's email (or admin super email as proxy)
    const ownerEmail = client.google.email || config.admin.superAdminEmail;
    issueClientSession(res, client.id, ownerEmail);
    const redirect = req.query.redirect || req.body.redirect || '/dashboard';
    // Only allow relative redirects to prevent open redirect
    const safePath = redirect.startsWith('/') ? redirect : '/dashboard';
    res.redirect(safePath);
  } catch (err) { next(err); }
});

// Stop impersonating — clears client session and returns to admin panel
router.post('/stop-impersonating', (req, res) => {
  clearClientSession(res);
  res.redirect('/admin');
});

module.exports = router;
