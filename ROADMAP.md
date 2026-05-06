# Roadmap

Living document. Phases ship in order; "later" items are deliberate non-goals for v1.

---

## Phase 0 — Scaffolding ✅

- [x] Project structure, package.json, env loader
- [x] SQLite schema + migrations
- [x] AES-256-GCM token encryption
- [x] Admin auth (HMAC-signed cookie session)
- [x] Webhook ingestion route (`/v1/webhooks/incoming/:client_uuid`)
- [x] Lead normalizer (loose field-name matching)
- [x] Template engine (`{{placeholder}}` substitution)
- [x] Admin dashboard with DMR Media branding
- [x] Smoke test: webhook → DB row written

---

## Phase 1 — Self-serve onboarding + Gmail API send ✅

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
