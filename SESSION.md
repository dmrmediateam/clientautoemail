# SESSION — What to work on next

Living working doc. Update at the start of each session.  
Last updated: **2026-05-24**

---

## Current status

App is **live and sending** on Vercel. Multi-client. Cron runs every 15 min.  
Two active clients: **max@dmrmedia.org** and **Marquis Farwell Homes** (Samantha Marquis).

| Item | Status |
|---|---|
| Cron sending | ✅ Working (GET route fixed) |
| Sam seller leads | ⚠️ Sam's token revoked — fallback to `linda.farwell@compass.com` → `team@dmrmedia.org` |
| Gmail scope | ✅ `gmail.send` only (dropped `gmail.modify`) |
| Google OAuth verification | ⏳ Not submitted yet |
| Dashboard sender health | ✅ Shipped |

---

## Immediate next actions (in order)

### 1. Fix Sam's seller sender — 15 min
Sam (`samantha.marquis@compass.com`) has a revoked token. Leads are sending via Linda as fallback, but they should come from Sam.

**Options (pick one):**
- A. Ask Sam to go to `/auth/google/start` and reconnect her Google account ← cleanest
- B. Update Marquis `seller_sender_email` in DB to `linda.farwell@compass.com` if Sam is unavailable long-term

```sql
-- Option B: set Linda as permanent seller sender for Marquis
UPDATE client_settings
SET seller_sender_email = 'linda.farwell@compass.com'
WHERE client_id = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';
```

---

### 2. Submit for Google OAuth verification — 1–2 hrs setup, then wait
Now that we only use `gmail.send`, the path is clear. Steps:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → OAuth consent screen
2. Fill in: App name, logo, support email (`team@dmrmedia.org`), homepage (`https://dmrmedia.org`), privacy policy URL, terms URL
3. Add scopes: `gmail.send`, `userinfo.email`, `userinfo.profile`
4. Record a 1–2 min screen recording showing: OAuth flow → dashboard → test send → email received in Gmail
5. Click "Submit for verification"
6. Wait 4–6 weeks. In the meantime the app still works — existing users are unaffected.

---

### 3. Analytics — v1.1 *(highest client-visible value)*
Clients are asking "is this working?" right now they can only count rows.

**Quickest wins (in order):**
- [ ] **Open tracking** — add a `<img src="https://email.dmrmedia.org/t/{msgId}.png" />` pixel to outgoing emails. Log `opened_at` when the pixel loads. ~2 hrs.
- [ ] **Stats cards on dashboard** — "X leads · Y sent · Z opens" using existing `messages` data. ~1 hr.
- [ ] **Daily digest email** — cron sends "Yesterday: 3 leads, 3 sent, 1 opened" to agent each morning. ~2 hrs.

---

### 4. Drip sequences — v1.2 *(biggest revenue unlock)*
One email is good. A 3-step follow-up sequence gets 3× more replies. This is the main reason clients would pay more.

Schema change needed: `sequences` + `sequence_steps` tables.  
See ROADMAP.md v1.2 for full spec.

---

### 5. Framework / server health assessment

Current stack: **Express 4 + Vercel serverless + Neon Postgres**. This is fine for current scale.

**What you don't need to change yet:**
- Express 4 → 5: Express 5 is stable but not required. No breaking issues.
- Node 18 → 20/22: Works on Vercel. Worth bumping `engines` in `package.json` to `>=20` eventually but not urgent.
- Vercel → other hosting: Vercel handles cold starts well for this workload. No reason to change.
- Neon Postgres: Handles thousands of clients easily. Fine.

**What is worth adding when you have 10+ clients:**
- [ ] A proper error alerting service (Sentry or Better Stack) — right now errors are silent unless you check Vercel logs
- [ ] Rate limiting middleware on the webhook endpoint (currently none — a bad actor could flood the DB)
- [ ] Connection pooling config tuning in `src/db.js` (`max: 5` recommended for Vercel serverless)

---

## Known issues / tech debt

| Issue | Severity | Fix |
|---|---|---|
| `samanthamarquishomes@gmail.com` has `google_connected=true` but no refresh token | Medium | Remove or flag this row; it's misleading |
| No rate limiting on `/v1/webhooks/incoming/*` | Medium | Add `express-rate-limit` for webhook endpoint |
| No error alerting (silent failures in Vercel logs) | Medium | Add Sentry free tier |
| `findByGmailMessageId` doesn't exist in messagesRepo yet (dead code from gmail.modify era) | Low | Remove or implement |
| Multi-level fallback (`sendWithFallback`) duplicated in cron.js and `_trigger-send-queued.js` | Low | Extract to `src/services/dispatcher.js` |

---

## Client roster

| Client | Status | Notes |
|---|---|---|
| max@dmrmedia.org (internal) | ✅ Active | Max's own leads, token healthy |
| Marquis Farwell Homes | ⚠️ Degraded | Sam token revoked; Linda fallback working |

---

## Env vars needed for next features

| Var | Needed for | Notes |
|---|---|---|
| `SENTRY_DSN` | Error alerting | Free tier, sign up at sentry.io |
| `TRACKING_BASE_URL` | Open pixel tracking | Same as `PUBLIC_BASE_URL` usually |
