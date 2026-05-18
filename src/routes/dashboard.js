'use strict';

const path = require('path');
const ejs = require('ejs');
const express = require('express');
const config = require('../config');
const clientsRepo = require('../repos/clients');
const conversationsRepo = require('../repos/conversations');
const messagesRepo = require('../repos/messages');
const dispatcher = require('../services/dispatcher');
const google = require('../services/google');
const { nextWindowStart } = require('../services/scheduler');

const VIEWS_DIR = path.join(__dirname, '../../views');

async function sidebarHtml(page, client, isAdminImpersonating) {
  return ejs.renderFile(
    path.join(VIEWS_DIR, '_dash_sidebar.ejs'),
    { page, client, isAdminImpersonating: !!isAdminImpersonating }
  );
}

const router = express.Router();

function flashFromQuery(req) {
  const q = req.query || {};
  if (q.connected) return { type: 'success', text: 'Gmail connected. Your bridge is live.' };
  if (q.saved) return { type: 'success', text: 'Settings saved.' };
  if (q.tested === 'ok') return { type: 'success', text: 'Test lead queued — cron will send it in your business window.' };
  if (q.tested === 'fail') return { type: 'error', text: q.reason || 'Test send failed.' };
  if (q.paused) return { type: 'info', text: 'Bridge paused. Webhooks will be ignored until you resume.' };
  if (q.resumed) return { type: 'success', text: 'Bridge resumed.' };
  if (q.replied) return { type: 'success', text: 'Reply queued and ready to send.' };
  if (q.approved) return { type: 'success', text: `Approved — ${q.approved} message${q.approved > 1 ? 's' : ''} queued for sending.` };
  if (q.sent) return { type: 'success', text: 'Email sent successfully.' };
  if (q.saved && q.msg) return { type: 'success', text: q.msg };
  return null;
}

router.get('/', async (req, res, next) => {
  try {
    const [conversations, recentMessages] = await Promise.all([
      conversationsRepo.listWithPreview(req.client.id, 50),
      messagesRepo.listRecentByClient(req.client.id, 100),
    ]);
    const teamMembers = await clientsRepo.listUsersForClient(req.client.id);
    const sidebar = await sidebarHtml('dashboard', req.client, req.isAdminImpersonating);
    res.render('client_dashboard', {
      brand: config.brand,
      publicBaseUrl: config.publicBaseUrl,
      client: req.client,
      page: 'dashboard',
      currentUser: req.currentUser || null,
      isAdminImpersonating: req.isAdminImpersonating || false,
      teamMembers,
      conversations,
      recentMessages,
      nextSendAt: nextWindowStart({
        nowMs: Date.now(),
        sendWindowStart: req.client.settings?.send_window_start,
        sendWindowEnd: req.client.settings?.send_window_end,
        timezone: req.client.settings?.timezone,
      }),
      flash: flashFromQuery(req),
      sidebarHtml: sidebar,
    });
  } catch (err) { next(err); }
});

router.get('/campaigns', async (req, res, next) => {
  try {
    const { query } = require('../db');
    const r = await query(
      `SELECT
         SUM(CASE WHEN c.lead_type = 'seller' THEN 1 ELSE 0 END)::int AS seller_leads,
         SUM(CASE WHEN c.lead_type = 'buyer'  THEN 1 ELSE 0 END)::int AS buyer_leads,
         SUM(CASE WHEN c.lead_type = 'seller' AND m.status = 'sent' THEN 1 ELSE 0 END)::int AS seller_sent,
         SUM(CASE WHEN c.lead_type = 'buyer'  AND m.status = 'sent' THEN 1 ELSE 0 END)::int AS buyer_sent
       FROM conversations c
       LEFT JOIN messages m ON m.conversation_id = c.id AND m.direction = 'outbound'
       WHERE c.client_id = $1`,
      [req.client.id]
    );
    const stats = r.rows[0] || {};
    const sidebar = await sidebarHtml('campaigns', req.client, req.isAdminImpersonating);
    res.render('campaigns', {
      brand: config.brand,
      publicBaseUrl: config.publicBaseUrl,
      client: req.client,
      isAdminImpersonating: req.isAdminImpersonating || false,
      stats,
      page: 'campaigns',
      flash: flashFromQuery(req),
      sidebarHtml: sidebar,
    });
  } catch (err) { next(err); }
});

router.post('/campaigns/:type/toggle', async (req, res, next) => {
  try {
    const type = req.params.type;
    if (type !== 'seller' && type !== 'buyer') return res.status(400).send('Invalid campaign type');
    const current = req.client.settings || {};
    const pauseKey = type === 'seller' ? 'seller_paused' : 'buyer_paused';
    const nowPaused = !!current[pauseKey];
    await clientsRepo.update(req.client.id, { [pauseKey]: !nowPaused });
    const action = nowPaused ? 'activated' : 'paused';
    res.redirect(`/dashboard/campaigns?saved=1&msg=${encodeURIComponent(`${type.charAt(0).toUpperCase() + type.slice(1)} campaign ${action}.`)}`);
  } catch (err) { next(err); }
});

router.get('/template', async (req, res, next) => {
  try {
    const teamMembers = await clientsRepo.listUsersForClient(req.client.id);
    res.render('client_template', {
      brand: config.brand,
      publicBaseUrl: config.publicBaseUrl,
      client: req.client,
      isAdminImpersonating: req.isAdminImpersonating || false,
      teamMembers,
      flash: flashFromQuery(req),
    });
  } catch (err) { next(err); }
});

router.post('/template', async (req, res, next) => {
  try {
    const buyerSubject = (req.body.buyer_template_subject || '').trim();
    const buyerBody = req.body.buyer_template_body || '';
    const sellerSubject = (req.body.seller_template_subject || '').trim();
    const sellerBody = req.body.seller_template_body || '';
    if (!buyerSubject || !buyerBody.trim() || !sellerSubject || !sellerBody.trim()) {
      return res.redirect('/dashboard/template?error=empty');
    }
    await clientsRepo.update(req.client.id, {
      template_subject: buyerSubject,
      template_body: buyerBody,
      buyer_template_subject: buyerSubject,
      buyer_template_body: buyerBody,
      seller_template_subject: sellerSubject,
      seller_template_body: sellerBody,
      buyer_sender_email: (req.body.buyer_sender_email || '').trim().toLowerCase(),
      seller_sender_email: (req.body.seller_sender_email || '').trim().toLowerCase(),
      team_signature_enabled: req.body.team_signature_enabled === 'on',
      cc_email: (req.body.cc_email || '').trim(),
      send_window_start: (req.body.send_window_start || req.client.settings?.send_window_start || '08:30').trim(),
      send_window_end: (req.body.send_window_end || req.client.settings?.send_window_end || '18:00').trim(),
      timezone: (req.body.timezone || req.client.settings?.timezone || 'America/Chicago').trim(),
      daily_send_limit: Number(req.body.daily_send_limit || req.client.settings?.daily_send_limit || 5),
    });
    res.redirect('/dashboard?saved=1');
  } catch (err) { next(err); }
});

router.post('/identity', async (req, res, next) => {
  try {
    await clientsRepo.update(req.client.id, {
      name: (req.body.name || '').trim() || req.client.name,
      agent_name: (req.body.agent_name || '').trim() || req.client.agent_name,
      agent_phone: (req.body.agent_phone || '').trim(),
      website: (req.body.website || '').trim(),
    });
    res.redirect('/dashboard?saved=1');
  } catch (err) { next(err); }
});

router.post('/pause', async (req, res, next) => {
  try {
    await clientsRepo.update(req.client.id, { active: false });
    res.redirect('/dashboard?paused=1');
  } catch (err) { next(err); }
});

router.post('/resume', async (req, res, next) => {
  try {
    await clientsRepo.update(req.client.id, { active: true });
    res.redirect('/dashboard?resumed=1');
  } catch (err) { next(err); }
});

router.post('/test', async (req, res, next) => {
  try {
    const target = (req.body.to || req.client.google.email || req.client.agent_email || '').trim();
    if (!target) return res.redirect('/dashboard?tested=fail&reason=' + encodeURIComponent('No target email'));

    const samplePayload = {
      name: 'Test Lead',
      email: target,
      phone: '555-555-0123',
      property_address: '123 Sample Drive, Beverly Hills, CA',
      property_url: 'https://example.com/listing/123',
      message: 'This is a test from the DMR Media bridge.',
      source: 'DMR Test',
      lead_type: 'buyer',
    };

    const fresh = await clientsRepo.findById(req.client.id);
    const result = await dispatcher.processLead({ client: fresh, rawPayload: samplePayload });

    if (result.ok) return res.redirect('/dashboard?tested=ok');
    return res.redirect('/dashboard?tested=fail&reason=' + encodeURIComponent(result.reason || result.error || 'unknown'));
  } catch (err) { next(err); }
});

router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await conversationsRepo.findById(req.params.id);
    if (!conversation || conversation.client_id !== req.client.id) {
      return res.status(404).send('Conversation not found');
    }
    const [messages, priorConvs] = await Promise.all([
      messagesRepo.listForConversation(conversation.id),
      conversationsRepo.listPriorForLead(req.client.id, conversation.lead_email, conversation.id),
    ]);
    // Attach messages to each prior conversation
    const priorHistory = await Promise.all(
      priorConvs.map(async (c) => ({
        ...c,
        messages: await messagesRepo.listForConversation(c.id),
      }))
    );
    res.render('conversation', {
      brand: config.brand,
      publicBaseUrl: config.publicBaseUrl,
      client: req.client,
      isAdminImpersonating: req.isAdminImpersonating || false,
      conversation,
      messages,
      priorHistory,
      page: 'dashboard',
      flash: flashFromQuery(req),
    });
  } catch (err) { next(err); }
});

router.post('/conversations/:id/approve', async (req, res, next) => {
  try {
    const conversation = await conversationsRepo.findById(req.params.id);
    if (!conversation || conversation.client_id !== req.client.id) {
      return res.status(404).send('Conversation not found');
    }
    const count = await messagesRepo.approvePending(conversation.id);
    res.redirect(`/dashboard/conversations/${conversation.id}?approved=${count}`);
  } catch (err) { next(err); }
});

router.post('/conversations/:id/reply', async (req, res, next) => {
  try {
    const conversation = await conversationsRepo.findById(req.params.id);
    if (!conversation || conversation.client_id !== req.client.id) {
      return res.status(404).send('Conversation not found');
    }
    const body = String(req.body.body || '').trim();
    if (!body) {
      return res.redirect(`/dashboard/conversations/${conversation.id}?tested=fail&reason=${encodeURIComponent('Reply body is required')}`);
    }
    const subject = (req.body.subject || '').trim() || `Re: ${conversation.property_address || 'Your inquiry'}`;
    const lastMessages = await messagesRepo.listForConversation(conversation.id);
    const latest = lastMessages[lastMessages.length - 1] || null;

    // Pick sender: per-type designated sender → client-level tokens
    const leadType = conversation.lead_type || 'buyer';
    const perTypeSender = leadType === 'seller'
      ? (req.client.settings?.seller_sender_email || '')
      : (req.client.settings?.buyer_sender_email || '');
    const sendFromEmail = perTypeSender || req.client.settings?.send_from_email || '';

    let senderUser = null;
    if (sendFromEmail) {
      const teamUsers = await clientsRepo.listUsersForClient(req.client.id);
      senderUser = teamUsers.find(u => u.email.toLowerCase() === sendFromEmail.toLowerCase() && u.connected) || null;
    }

    const sendOpts = {
      to: { email: conversation.lead_email, name: conversation.lead_name || '' },
      subject,
      body,
      threadId: conversation.thread_id || latest?.gmail_thread_id || undefined,
      inReplyTo: latest?.internet_message_id || undefined,
      references: latest?.internet_message_id || undefined,
    };

    async function trySend(opts) {
      if (senderUser) return google.sendAsUserRow(senderUser, req.client.agent_name, opts);
      return google.sendAsClient(req.client, opts);
    }

    let sendResult;
    try {
      sendResult = await trySend(sendOpts);
    } catch (gmailErr) {
      // Stale thread_id → Gmail 404. Clear it and retry as a fresh email.
      if (gmailErr.code === 404 || String(gmailErr.message).includes('not found')) {
        await conversationsRepo.updateThreadId(conversation.id, null);
        sendResult = await trySend({ ...sendOpts, threadId: undefined, inReplyTo: undefined, references: undefined });
      } else {
        throw gmailErr;
      }
    }

    await messagesRepo.create({
      conversation_id: conversation.id,
      client_id: req.client.id,
      direction: 'outbound',
      from_email: sendFromEmail || req.client.google.email || req.client.agent_email,
      to_email: conversation.lead_email,
      subject,
      body,
      status: 'sent',
      sent_at: Date.now(),
      gmail_message_id: sendResult.messageId,
      gmail_thread_id: sendResult.threadId,
      internet_message_id: null,
    });
    if (sendResult.threadId) {
      await conversationsRepo.updateThreadId(conversation.id, sendResult.threadId);
    }
    return res.redirect(`/dashboard/conversations/${conversation.id}?replied=1`);
  } catch (err) { next(err); }
});

module.exports = router;
