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

## Phase 1 — Self-serve onboarding + Gmail API send 🚧 (current)

The pivot from operator-managed to self-serve. Each agent signs themselves up and gets an automation dashboard.

- [ ] Replace SendGrid with Gmail API direct send (`googleapis` `users.messages.send`)
- [ ] Public `/onboarding` landing page — "Sign in with Google" button, value prop, DMR brand
- [ ] Auto-create client record on first OAuth callback (provisioning)
- [ ] Client-facing dashboard at `/dashboard` (gated by Google session, separate from admin)
  - [ ] Show webhook URL with copy-to-clipboard
  - [ ] Editable template (subject + body)
  - [ ] Recent sends table
  - [ ] Pause/resume toggle
  - [ ] Disconnect Google + sign out
- [ ] Remove SendGrid code + dependency
- [ ] Update admin to reflect self-serve model (remove "Connect Gmail" buttons)
- [ ] First end-to-end test: max@amarketology.com signs up, fires webhook, receives email

**Definition of done:** A new agent can land on `email.dmrmedia.org/onboarding`, sign in with their Gmail, copy their webhook URL, fire a test request, and watch the email land in their inbox without any DMR Media operator touching anything.

---

## Phase 2 — Production hardening

- [ ] Domain-verify `dmrmedia.org` in Google Cloud (publish OAuth consent screen)
- [ ] Submit Gmail-send scope for Google verification (required to leave Testing mode and onboard >100 agents)
- [ ] Reverse-proxy config (nginx or Caddy) for `email.dmrmedia.org`
- [ ] Process manager (`pm2` or `systemd`) on the dmrmedia.org host
- [ ] Structured logging (replace `console.log` with `pino` or similar)
- [ ] Rate limiting on `/v1/webhooks/incoming/*` per client
- [ ] Per-client send rate cap with Redis (avoid hitting Gmail's 500/day limit blindly)
- [ ] OAuth-revocation handling: detect 401, mark client `needs_reconnect`, email the agent a re-link
- [ ] Backups for SQLite (or migrate to Postgres if size warrants)
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
- **Inbox parsing** — we have `gmail.send` scope only; expanding scopes triggers another verification round. Don't ask for inbox read until there's a clear product reason.
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

### 2026-04-30 — Self-serve onboarding model
- **Context:** Initial design had DMR Media operators manually onboarding each client.
- **Decision:** Public `/onboarding` page, agent signs in with Google, account auto-provisions. Operators retain `/admin` for monitoring and override.
- **Why:** Removes a manual step from every new-client cycle. Sales motion becomes "send them a link" instead of "schedule a 30-min onboarding call."
