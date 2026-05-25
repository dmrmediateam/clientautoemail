# Roadmap — DMR Lead Engine

> The ultimate personal-email automation platform. Think Google Ads campaign management — but powered by each agent's own Gmail inbox.

Living document. Phases ship in order. Append decisions to the log at the bottom.

---

## ✅ v1.0 — Foundation  *(shipped May 18 2026)*

Everything needed to run a live, multi-client email automation service.

**Core infrastructure**
- [x] Multi-tenant webhook ingestion (`/v1/webhooks/incoming/:client_uuid`)
- [x] Lead normalizer — loose field-name matching, works with any CRM/LP format
- [x] AES-256-GCM token encryption for stored OAuth refresh tokens
- [x] PostgreSQL schema (`clients`, `client_settings`, `conversations`, `messages`, `webhook_payloads`)
- [x] Vercel cron every 15 min — send queued messages via `/api/cron/send-queued`
- [x] Gmail API direct send — email goes from agent's own inbox, Google-signed DKIM
- [x] Smart send window — business-hours scheduling per client timezone
- [x] Self-serve onboarding — agent clicks "Sign in with Google", account auto-provisions

**Client dashboard**
- [x] Webhook URL with copy-to-clipboard
- [x] Editable template (subject + body with `{{placeholder}}` variables)
- [x] Left-hand sidebar nav — Dashboard / Campaigns / Templates
- [x] Campaigns page — seller & buyer cards, live status badges, leads/sent stats
- [x] Campaign toggle switches — pause or activate seller/buyer campaigns instantly
- [x] Send window + timezone display on campaign cards
- [x] Conversation thread view — full message history per lead
- [x] Prior contact history — collapsible panel showing earlier threads with the same email
- [x] Sender status panel — green/amber/red health dot per team member, reconnect link for broken tokens

**Admin panel**
- [x] Client list + impersonation ("view as client")
- [x] Conversation browser across all clients
- [x] "Send Now" button — manually fire a queued/stuck message immediately
- [x] Cron bug fixed: Vercel sends GET, route was POST-only (nothing ever sent until fix)

---

## ✅ v1.0.1 — Reliability & Scope Hardening  *(shipped May 24 2026)*

- [x] **Token revocation recovery** — `ensureFreshUserToken` now converts `invalid_grant` HTTP 400/401 errors into typed `GOOGLE_REVOKED` / `GOOGLE_NOT_CONNECTED` codes so downstream catch blocks work correctly
- [x] **Smarter sender fallback** — when primary sender token fails: try other connected team members → then fall back to `team@dmrmedia.org` (same logic in cron + manual script)
- [x] **Dropped `gmail.modify` scope** — removed `listInboundMessages`, `watchMailbox`, and `/gmail/push` webhook route; app now uses `gmail.send` only, aligning code with privacy policy and qualifying for Google OAuth verification without a paid security audit
- [x] **Dashboard sender health** — each team member shown with connection status; red alert banner when an active buyer/seller sender is broken

---

## 🔜 v1.1 — Google OAuth Verification  *(highest priority)*

Required to remove the "unverified app" warning and lift the 7-day token expiry for new users.

- [ ] Verify `dmrmedia.org` in Google Search Console
- [ ] Complete OAuth consent screen — logo, support email, homepage URL, privacy policy URL, terms URL (pages already exist)
- [ ] Record a short demo video showing the OAuth flow (Google requires this)
- [ ] Submit for verification — `gmail.send` is a *sensitive* scope, **no paid security audit needed**
- [ ] Estimated timeline: 4–6 weeks after submission

---

## v2.0 — Calendar → Google Ads Conversion Tracking  *(close the ROI loop)*

When a lead books an appointment in the agent's Google Calendar, upload it as an offline conversion to Google Ads. Now the agent knows exactly which ad spend drove appointments.

- [ ] Calendar polling — `calendar.readonly`, list events updated since last poll per connected client
- [ ] `calendar_events` table — dedupe by `iCalUID`, link to `conversations.lead_email`
- [ ] Capture GCLID from original lead webhook, store on `conversations`
- [ ] Google Ads API — developer token, per-client customer ID + conversion action resource name
- [ ] `ConversionUploadService.UploadClickConversions` — daily cron upload
- [ ] Conversions tab on dashboard — Lead → Email → Appointment → Ads upload ✓
- [ ] Backfill past calendar events once the pipe is built

---

## v2.1 — Multi-Campaign Architecture  *(full campaign manager)*

Right now clients have 2 campaigns (seller, buyer). Expand to unlimited — just like Google Ads campaign groups.

- [ ] **`campaigns` table** — `id`, `client_id`, `name`, `lead_type`, `paused`, `sequence_id`, `sender_id`, `send_window_*`
- [ ] **Campaign builder UI** — name it, pick lead type/tag, assign sequence, assign sender, set window
- [ ] **Tag-based routing** — route leads to campaigns based on payload fields (`lead_type=luxury` → Luxury Sellers campaign)
- [ ] **Multiple senders per client** — different team members on different campaigns
- [ ] **Campaign-level send windows** — luxury leads get 9AM–5PM; investor leads get extended hours
- [ ] **Side-by-side campaign performance** — leads / sent / open rate / reply rate / conversions per campaign

---

## v2.5 — Monetization & Operator Growth

- [ ] **Stripe billing** — per-client monthly subscription, tiered by active campaigns + lead volume
- [ ] **Plan limits** — Free: 1 campaign / 50 leads/mo · Pro: unlimited campaigns / unlimited leads
- [ ] **Usage dashboard** — admin sees email volume per client, approaching-limit alerts
- [ ] **White-label for brokerages** — brokerage logo on agent dashboards; all agents under one account
- [ ] **Brokerage admin** — broker can see all agents' campaigns, pause any agent, review templates
- [ ] **Referral codes** — agents refer agents, earn credit

---

## v3.0 — Self-Serve Platform  *(beyond real estate)*

The platform becomes general-purpose. Any business that gets leads via webhook can use it.

- [ ] **Industry template packs** — Real Estate, Mortgage, Insurance, Auto — pre-built sequences per vertical
- [ ] **Visual field mapper** — drag-and-drop any webhook field to a template variable
- [ ] **Zapier / Make.com connector** — receive leads from any source, not just Luxury Presence
- [ ] **Multi-inbox / round-robin** — connect multiple Gmail accounts to one campaign, distribute sends across team
- [ ] **Team seats + roles** — invite members (admin / editor / viewer)
- [ ] **Public API** — documented REST so partners integrate directly
- [ ] **Self-serve setup wizard** — connect Gmail → build first campaign → paste webhook URL → done in 5 minutes

---

## v3.5 — Multi-Channel  *(when email isn't enough)*

- [ ] **SMS follow-up** — Twilio as an optional step in any sequence (after email, send SMS)
- [ ] **TCPA compliance gate** — require explicit opt-in before any SMS step goes live
- [ ] **WhatsApp Business API** — international clients, high-touch luxury market
- [ ] **Voicemail drop** — optional sequence step (pre-recorded, no ring)

---

## Google OAuth Verification  *(parallel track — now top priority)*

Required to lift 7-day token expiry and remove the "unverified app" warning screen for new users.

- [ ] Verify `dmrmedia.org` in Google Search Console
- [ ] Complete OAuth consent screen — logo, support email, homepage URL
- [ ] Record YouTube demo (onboarding → dashboard → test send → email received)
- [ ] Submit brand verification → "In production" status
- [ ] **`gmail.send` scope only** ✅ — no CASA Tier 2 audit needed. Standard Google review (~4–6 weeks, free).

---

## Decision Log

Append-only. Newest at top.

### 2026-05-24 — Dropped `gmail.modify`; smarter fallback order; dashboard sender health
- Removed `listInboundMessages()`, `watchMailbox()`, and `/gmail/push` route. App now uses `gmail.send` scope only — consistent with privacy policy and sufficient for all sending use cases. Qualifies for Google's standard verification review (no $15k+ security audit).
- `sendWithFallback()` helper added to cron and manual trigger script: primary sender → other connected team members → `team@dmrmedia.org`. Previously jumped straight to admin fallback.
- Dashboard "Sender status" panel added: each team member shown with green/amber/red health indicator and reconnect link when token is broken. Red alert banner shown if active buyer/seller sender is revoked.

### 2026-05-18 — v1.0 shipped, roadmap reformatted as campaign platform
- Reframed vision: "Google Ads campaign management for personal email" — multiple campaigns, drip sequences, analytics, A/B testing, conversion tracking.
- Marked all Phase 0 / Phase 1 / Phase 1.5 work as complete.
- Non-goals updated: A/B testing and AI personalization promoted to v1.3 (previously "never").

### 2026-05-18 — Cron bug fixed (GET vs POST)
- Vercel cron sends GET requests. Route was POST-only. Nothing had ever been sent by the cron since launch.
- Fix: added `router.get('/send-queued')` alongside existing POST. Extracted `sendOneMessage()` helper.
- Two stuck messages for Marquis Farwell manually fired via new admin "Send Now" button.

### 2026-05-04 — Migrated SQLite → Postgres
- SQLite via `better-sqlite3` incompatible with Vercel serverless. Switched to Postgres via `pg` driver.

### 2026-05-04 — Ship email-only, calendar/Ads in Phase 2
- Calendar + Ads blocked launch by weeks. Deploy email now. Conversions backfill retroactively.

### 2026-04-30 — Self-serve onboarding
- Changed from operator-managed to public `/onboarding`. Sales motion = "send them a link."

### 2026-04-30 — Gmail API direct send, drop SendGrid
- Gmail's DMARC `p=reject` blocks third-party SMTP from sending as `@gmail.com`. Switched to Gmail API per-agent OAuth. Email arrives from agent's own inbox, Google-signed DKIM. Rate limit: 500–2000/day per account (acceptable for lead volume).


---

## Decision Log

Append-only. Newest at top.

### 2026-05-18 — v1.0 shipped, roadmap reformatted as campaign platform
- Reframed vision: "Google Ads campaign management for personal email" — multiple campaigns, drip sequences, analytics, A/B testing, conversion tracking.
- Marked all Phase 0 / Phase 1 / Phase 1.5 work complete. Removed old phase numbering, replaced with version-based milestones.
- Non-goals updated: A/B testing and AI personalization promoted to v1.3 roadmap items.

### 2026-05-18 — Cron bug fixed (GET vs POST)
- Vercel cron sends GET requests. Route was POST-only since launch — nothing had ever been sent by the cron.
- Fix: added `router.get('/send-queued')` alongside existing POST. Extracted `sendOneMessage()` helper.
- Two stuck messages for Marquis Farwell (Betty Millman, Judith Chigi) manually fired via new admin "Send Now" button.

### 2026-05-04 — Migrated SQLite → Postgres (Vercel)
- SQLite via `better-sqlite3` incompatible with Vercel serverless (no persistent local disk). Switched to Postgres via `pg` driver with `DATABASE_URL`.

### 2026-05-04 — Ship email-only, calendar/Ads in Phase 2
- Calendar polling + Google Ads conversion upload would block launch by weeks. Decision: deploy email automation now. Add `calendar.readonly` to initial OAuth scope so no re-prompt when Phase 2 ships. Conversions can be backfilled retroactively.

### 2026-04-30 — Self-serve onboarding
- Changed from operator-managed onboarding to public `/onboarding` page. Agent clicks "Sign in with Google", account auto-provisions. Sales motion = "send them a link."

### 2026-04-30 — Gmail API direct send, drop SendGrid
- Gmail's DMARC `p=reject` blocks third-party SMTP from sending as `@gmail.com`. Switched to Gmail API per-agent OAuth token. Email arrives from agent's own inbox, Google-signed DKIM, lands in Sent folder. Rate limit: ~500/day free, ~2000/day Workspace (acceptable for lead follow-up volume).


The pivot from operator-managed to self-serve. Each agent signs themselves up and gets an automation dashboard.

- [x] Replace SendGrid with Gmail API direct send (`googleapis` `users.messages.send`)
- [x] Public `/onboarding` landing page — "Sign in with Google" button, value prop, DMR brand
- [x] Auto-create client record on first OAuth callback (provisioning)
- [x] Client-facing dashboard at `/dashboard` (gated by Google session, separate from admin)
  - [x] Show webhook URL with copy-to-clipboard
  - [x] Editable template (subject + body)
  - [x] Recent sends table
  - [x] Pause/resume toggle
  - [x] Disconnect Google + sign out
- [x] Remove SendGrid code + dependency
- [x] Update admin to reflect self-serve model
- [x] Migrate to Postgres (Vercel Postgres / Neon) — single-file SQLite swapped for serverless-friendly Postgres
- [x] Schema v2: `client_settings`, `conversations`, `messages` (replaces flat `leads` table)
- [x] Inbound reply tracking via Gmail Push (Pub/Sub) → `/v1/webhooks/gmail/push`
- [x] Cron-driven send queue at `/api/cron/send-queued` (Vercel cron, every 15 min)

---

## Phase 1.5 — First production client (Luxury Presence) 🚧 (current)

Ship what's built to a real client. Email-only, bare-minimum scopes (Gmail only — no Calendar yet). Run in OAuth "Testing" mode initially while submitting for verification in parallel.

- [ ] Verify Vercel Postgres provisioned + `DATABASE_URL` env var set in Vercel project
- [ ] Run `npm run migrate:v2` against production DB
- [ ] Confirm all production env vars set in Vercel (CRON_SECRET, ENCRYPTION_KEY, GOOGLE_*, GMAIL_PUBSUB_TOPIC, GMAIL_PUSH_VERIFICATION_TOKEN, ADMIN_*)
- [ ] Deploy from Vercel dashboard
- [ ] In Google Cloud Console: add first client's Gmail to OAuth "Test users" list
- [ ] Onboard first client: connect Gmail (click through "unverified app" warning), copy webhook URL into Luxury Presence
- [ ] Configure Pub/Sub topic + push subscription pointed at `/v1/webhooks/gmail/push?token=...`
- [ ] Smoke test: real lead from Luxury Presence → email sent → reply tracked
- [ ] **Day 7 check:** verify refresh token still works (Testing-mode tokens may expire after 7 days for sensitive scopes)

**Definition of done:** First Luxury Presence lead arrives via webhook, agent's Gmail sends the templated reply within 60s, and any inbound reply is captured in the `messages` table with `direction='inbound'`.

---

## Phase 1.75 — Google OAuth verification (parallel track)

Submit for brand verification immediately so publishing status can move to "In production" — this removes the 7-day refresh token expiry that affects Testing-mode apps with restricted scopes.

- [ ] Publish privacy policy at `https://dmrmedia.org/privacy` (must be on the verified brand domain)
- [ ] Publish terms of service at `https://dmrmedia.org/terms`
- [ ] Verify domain ownership of `dmrmedia.org` in Google Search Console (linked to the same Google account that owns the OAuth project)
- [ ] Complete OAuth consent screen "App information" — app logo, support email, application home page
- [ ] Record YouTube demo video showing: agent landing on `/onboarding` → Google sign-in → consent screen → dashboard → webhook URL → test send → email arriving from agent's Gmail
- [ ] Submit for OAuth verification (brand verification first — gets us to "In production" quickly)
- [ ] **Restricted scope verification + CASA Tier 2 security assessment** — only required when approaching 100 active users. Defer until clearly needed. Budget: 6–12 weeks + $15K–$75K.

---

## Phase 2 — Calendar → Google Ads conversion tracking

The reason calendar permission gets granted in Phase 1.5: so when a lead books an appointment on the agent's Google Calendar, we capture it as a conversion and upload it to Google Ads.

- [ ] Calendar polling service: for each connected client, list events created/updated since last poll (`calendar.events.list` with `updatedMin`, `singleEvents=true`)
- [ ] New table `calendar_events` — fingerprint by `iCalUID` to dedupe across polls
- [ ] Conversion attribution: match event attendees' email against `conversations.lead_email` to link a calendar event back to the originating lead
- [ ] Google Ads API setup (separate from Gmail OAuth):
  - [ ] Apply for Google Ads developer token
  - [ ] Per-client: capture Ads customer ID + conversion action resource name
  - [ ] OAuth scope `https://www.googleapis.com/auth/adwords` (separate consent flow for Ads-enabled clients)
- [ ] Offline conversion upload: `ConversionUploadService.UploadClickConversions` — requires GCLID captured from the original lead webhook (Luxury Presence forwards it as a hidden field)
- [ ] Store GCLID on `conversations` row at lead intake time
- [ ] Cron job to upload pending conversions (`/api/cron/upload-conversions`) — daily
- [ ] Client dashboard: "Conversions" tab showing calendar event → lead → Ads upload status

---

## Phase 3 — Production hardening

- [ ] Domain-verify `dmrmedia.org` in Google Cloud (publish OAuth consent screen)
- [ ] Submit Gmail + Calendar scopes for Google verification (required to leave Testing mode and onboard >100 agents)
- [ ] Structured logging (replace `console.log` with `pino` or similar)
- [ ] Rate limiting on `/v1/webhooks/incoming/*` per client
- [ ] Per-client send rate cap (avoid hitting Gmail's 500/day limit blindly)
- [ ] OAuth-revocation handling: detect 401, mark client `needs_reconnect`, email the agent a re-link
- [ ] Healthcheck endpoint + uptime monitor (e.g., UptimeRobot)
- [ ] Error tracking (Sentry)

---

## Phase 3 — Operator UX

- [ ] Admin can "view as client" — impersonate a client to debug their dashboard
- [ ] Admin can manually trigger a re-send for a failed lead
- [ ] CSV export of leads
- [ ] Aggregate analytics: deliveries, opens, replies (Phase 3.5)
- [ ] Search across leads
- [ ] Filter by client, date, status

---

## Phase 4 — Agent UX polish

- [ ] Reply detection (Gmail webhooks) — mark a lead as "replied" automatically
- [ ] Multiple templates per client (e.g., one for buyers, one for sellers, one for high-value)
- [ ] Conditional template selection based on payload fields (price > X → luxury template)
- [ ] Drip sequences — send follow-up #2 if no reply in 48h
- [ ] Snippet library — agent's most-used phrases as one-click inserts
- [ ] Mobile-first dashboard pass

---

## Phase 5 — Growth & monetization

- [ ] Stripe billing — per-agent monthly subscription
- [ ] Self-serve plan upgrade / downgrade
- [ ] Referral codes
- [ ] White-label option for brokerages (their logo on the agent dashboard)
- [ ] API for partner integrations (Zapier, Make.com)
- [ ] Public-facing marketing site at email.dmrmedia.org root

---

## Deliberate non-goals (for now)

These come up but we're saying no until later:

- **HTML email editor** — plain text outperforms HTML for cold lead follow-up. Don't build this until an agent actually asks.
- **A/B testing of templates** — premature; need volume first.
- **Calendar write access** — we only need to *read* clients' calendars for conversion tracking, never create or modify events. `calendar.readonly` is sufficient and a much easier scope to justify in Google verification.
- **Multi-channel (SMS)** — separate compliance regime (TCPA), separate carrier setup. Not in scope.
- **CRM integrations beyond webhook ingestion** — clients can pipe Luxury Presence via webhook; that covers 90% of cases.

---

## Decision log

Architectural decisions and why we made them. Append-only.

### 2026-04-30 — Gmail API direct send, drop SendGrid
- **Context:** Initial design used SendGrid as the dispatch engine.
- **Problem:** Real-estate agent clients use `@gmail.com` addresses. Gmail's DMARC policy (`p=reject`) blocks any third-party SMTP from legitimately sending as `@gmail.com`. Domain authentication (the SendGrid scaling pattern) is impossible because we don't own gmail.com.
- **Decision:** Send directly via Gmail API using each agent's own OAuth refresh token. Email goes through Google's own SMTP, signed with Google's DKIM, lands in the agent's Sent folder.
- **Trade-off:** Per-account rate limits (~500/day free, ~2000/day Workspace). Acceptable for lead follow-up. Add Redis-backed queue + per-client throttle in Phase 2.
- **Reversibility:** Easy. Architecture isolates dispatch in `services/dispatcher.js` — can re-introduce SendGrid as a per-client opt-in for clients with custom domains, without rewriting the rest.

### 2026-04-30 — SQLite for v1, Postgres-portable schema
- **Context:** Spec called for Postgres + Redis.
- **Decision:** SQLite via `better-sqlite3` for v1. Single file, zero ops, sub-millisecond writes. Schema stays Postgres-compatible.
- **Trigger to migrate:** > 50 GB DB or > 100 writes/sec sustained, whichever comes first.

### 2026-05-04 — Ship email-only first, calendar/Ads tracking in Phase 2
- **Context:** First real client (Luxury Presence webhook) is ready to onboard. Original product vision includes capturing booked appointments from the client's Google Calendar and uploading them as offline conversions to Google Ads.
- **Problem:** Calendar polling + Google Ads conversion upload are unbuilt. Building them blocks the launch by weeks (Google Ads API has its own developer-token application + verification process).
- **Decision:** Deploy what's built (lead webhook → email → reply tracking) to production now. Add `calendar.readonly` to the OAuth scope list in this same release so the first client grants calendar permission during their initial Gmail consent — no re-prompt later when Phase 2 ships.
- **Trade-off:** No conversion data flows to Google Ads on day 1. Acceptable because the email response is the time-sensitive piece (lead-response speed), and conversions can be backfilled retroactively from `calendar_events` once Phase 2 ships.
- **Reversibility:** Trivially reversible — Phase 2 work is additive (new tables, new cron, new OAuth scope for Ads). No schema or contract changes to Phase 1 code.

### 2026-05-04 — Migrated SQLite → Postgres (Vercel) for serverless deploy
- **Context:** SQLite via `better-sqlite3` was great locally but file-based DBs are incompatible with Vercel's serverless functions (no persistent local disk between invocations).
- **Decision:** Switched to Postgres via the `pg` driver. Connection string injected via `DATABASE_URL` (or fallback `POSTGRES_URL` from the Vercel Postgres integration). SSL on by default.
- **Triggers replaced:** "50 GB DB or 100 writes/sec" trigger from the original SQLite decision is moot — Postgres came earlier than expected, driven by deploy target rather than scale.

### 2026-04-30 — Self-serve onboarding model
- **Context:** Initial design had DMR Media operators manually onboarding each client.
- **Decision:** Public `/onboarding` page, agent signs in with Google, account auto-provisions. Operators retain `/admin` for monitoring and override.
- **Why:** Removes a manual step from every new-client cycle. Sales motion becomes "send them a link" instead of "schedule a 30-min onboarding call."
