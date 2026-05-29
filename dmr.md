# DMR Media — Lead Response Bridge
## Operations, Client Onboarding & Google OAuth Verification Guide

> The authoritative playbook for deploying this software, onboarding new clients, and getting Google OAuth app verification approved.  
> Last updated: May 29, 2026

---

## What This Software Does

**One-sentence pitch:**  
"A real estate agent connects their Gmail account once. Every new lead from their website or ads gets a personalized, authentic email reply from their own inbox within seconds — automatically."

**How it works end-to-end:**
1. A lead submits a form on Luxury Presence (or any platform that supports webhooks)
2. LP fires a POST to this system's webhook URL: `POST /v1/webhooks/incoming/:client-uuid`
3. The system normalizes the lead, renders a personalized email from the agent's template
4. The email is queued and sent via the **Gmail API** using the agent's own OAuth tokens (`gmail.send` scope only)
5. The email lands in the agent's Gmail Sent folder — signed by Google's DKIM, looking exactly like they typed it

**What it is NOT:** It is not a bulk mailer. It is not a CRM. It is not SendGrid. Every email comes from the agent's personal Gmail account through Google's own infrastructure.

---

## Part 1 — Google OAuth App Verification (Step by Step)

### What Google Requires

This app uses **sensitive scopes** (not restricted), which means:
- ✅ No security audit required
- ✅ No CASA assessment required  
- ✅ No penetration test required
- ✅ Just a form + a ~60 second demo video

**Scopes in use:**

| Scope | Why |
|-------|-----|
| `gmail.send` | Send automated lead-response emails from the agent's Gmail account |
| `userinfo.email` | Identify which Google account is being connected |
| `userinfo.profile` | Display the connected user's name in the dashboard |

---

### Step 1 — Confirm Your App Info is Ready

Before touching the Google Console, verify all of these are live and accessible:

| Item | URL | Status |
|------|-----|--------|
| App homepage | `https://leads.dmrmedia.org/onboarding` (or your domain) | Must be live |
| Privacy policy | `https://leads.dmrmedia.org/privacy` | Built ✅ |
| Terms of service | `https://leads.dmrmedia.org/terms` | Built ✅ |
| App logo | Square PNG, 120×120px minimum | Prepare DMR logo |
| Developer email | `max@dmrmedia.org` | Ready ✅ |
| App name | `DMR Media Lead Responder` | Use this exact name |

> The privacy policy and terms MUST match the Google Cloud project's authorized domain. If your app is at `leads.dmrmedia.org`, the authorized domain must be `dmrmedia.org`.

---

### Step 2 — Open OAuth Consent Screen

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select the project that contains your OAuth 2.0 credentials (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel)
3. Left sidebar → **APIs & Services → OAuth consent screen**

---

### Step 3 — Fill Out App Information

Click **Edit App** (or start the form if not yet filled).

| Field | Exact Value to Enter |
|-------|---------------------|
| App name | `DMR Media Lead Responder` |
| User support email | `max@dmrmedia.org` |
| App logo | Upload DMR square logo PNG |
| App home page | `https://leads.dmrmedia.org/onboarding` |
| App privacy policy | `https://leads.dmrmedia.org/privacy` |
| App terms of service | `https://leads.dmrmedia.org/terms` |
| Authorized domains | `dmrmedia.org` |
| Developer contact email | `max@dmrmedia.org` |

Click **Save and Continue.**

---

### Step 4 — Add Scopes

1. Click **Add or Remove Scopes**
2. Add all three of these:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
3. Click **Update** → **Save and Continue**

---

### Step 5 — Add Test Users (Temporary)

While still in Testing mode, add every account you need working right now. After publishing (Step 6), this list won't matter anymore — anyone can connect.

Add at minimum:
- `max@dmrmedia.org`
- `team@dmrmedia.org`
- `linda.farwell@compass.com`
- `samantha.marquis@compass.com`

Click **Save and Continue.**

---

### Step 6 — PUBLISH THE APP (Do This Today)

> **This is the single most impactful step.** It immediately stops the 7-day refresh token expiry that causes `invalid_grant` errors and disconnected accounts.

1. On the OAuth consent screen summary page, look for **Publishing Status**
2. Click **Publish App**
3. Confirm

**After publishing:**
- Status: Testing → **In production**
- Anyone with a Google account can now connect
- Refresh tokens no longer expire after 7 days
- Users will see an "unverified app" warning — that is normal and expected until verification is complete. They click **Advanced → Continue to DMR Media Lead Responder** to proceed.

---

### Step 7 — Record the Demo Video (~60 seconds)

Google requires a screen recording showing the OAuth flow. This is mandatory for `gmail.send` scope.

**What to show in the video:**

1. Navigate to `https://leads.dmrmedia.org/onboarding` — show the homepage with the "Sign in with Google" button
2. Click **Sign in with Google**
3. The Google consent screen appears — pause on it so the reviewer can read the scopes: `gmail.send`, email, profile
4. Click **Allow** / Continue through the flow
5. Land on the client dashboard — show it briefly (the live status, the "Sending via..." address)
6. (Optional but recommended) Show a sample lead in the conversation view with a "Sent" email visible

**Hosting:** Upload to YouTube as **Unlisted** (not public). Copy the link.

---

### Step 8 — Submit for Verification

1. On the OAuth consent screen, click **Prepare for Verification** (or **Submit for Verification**)
2. Fill in the YouTube link
3. Write the scope justification. Copy this text exactly:

**`gmail.send`:**
> "Used to send automated personalized lead-response emails on behalf of connected real estate agents. When a new buyer or seller lead is received via webhook from the agent's lead generation platform (e.g. Luxury Presence), the system sends a single outbound email from the agent's own Gmail address to that lead. The agent's email is never read; only the send permission is used."

**`userinfo.email`:**
> "Used to identify which Google account is being connected, associate it with the correct agent profile in our system, and display the connected email address in the agent's dashboard."

**`userinfo.profile`:**
> "Used to pre-fill the agent's display name when they first connect their account."

4. Click **Submit for Verification**

Google will email `max@dmrmedia.org` with any questions. Typical response time: 3–14 business days.

---

### Verification Timeline

| Stage | What Changes |
|-------|-------------|
| **Testing** (current) | Only listed test users can connect. Tokens expire in 7 days. |
| **Published + Unverified** (after Step 6) | Anyone can connect. Tokens don't expire. "Unverified" warning shown. |
| **Verified** (3–14 days after Step 8) | No warning. Normal Google consent screen. |

---

## Part 2 — Readiness Audit: What's in Place, What's Missing

### Frontend & Client-Facing Features — Current State

| Feature | Where | Status |
|---------|-------|--------|
| Connect Gmail (OAuth) | `/onboarding` | ✅ Live |
| Client dashboard with live/paused status | `/dashboard` | ✅ Live |
| Email template editor (buyer + seller) | `/dashboard/template` | ✅ Live |
| Designated sender selector (buyer/seller) | `/dashboard/template` | ✅ Live |
| Sender health panel (shows disconnected accounts) | `/dashboard` | ✅ Live |
| Pause/Resume campaign button | `/dashboard` | ✅ Live |
| Lead conversation history | `/dashboard` | ✅ Live |
| Disconnect Google button | `/dashboard` | ✅ Live |
| Privacy policy | `/privacy` | ✅ Live |
| Terms of service | `/terms` | ✅ Live |
| Admin panel for managing all clients | `/admin` | ✅ Live |
| Webhook health check endpoint | `/v1/webhooks/incoming/:id/health` | ✅ Live |
| Daily system status report email | Cron at 1 PM UTC | ✅ Live |
| Automated send queue (every 15 min) | Cron GET /api/cron/send-queued | ✅ Live |

---

### What's Missing Before Taking on 10+ Clients

**Priority 1 — Must fix before scaling:**

| Gap | Impact | Fix |
|-----|--------|-----|
| Webhook URL not shown to the agent in their own dashboard | Agent cannot self-configure LP without calling you | Add webhook URL display to `/dashboard` |
| No client-facing "Add team member" prompt | Agents don't know to go to `/onboarding` again for teammates | Add a "Share onboarding link" button in `/dashboard` |
| `buyer_sender_email` not defaulted at account creation | New accounts silently use the owner's client-level token | Set `buyer_sender_email = agent_email` on `clients.create()` |
| Ghost user cleanup (`samanthamarquishomes@gmail.com`) | Confusion in Marquis dashboard, `connected=true` with no token | Delete from DB |

**Priority 2 — Nice to have before scale:**

| Gap | Impact | Fix |
|-----|--------|-----|
| No email notification to agent when a lead arrives | Agent doesn't know a response went out | Add notification toggle in settings |
| Domain auto-join could match wrong client on shared domains | `@gmail.com` would match any gmail client | Already safe — only matches `agent_email` domain, not personal Gmail (gmail.com is never an `agent_email`) |
| One designated sender per lead type | Can't split load across 2 buyer agents | v1.2 Campaigns (on ROADMAP) |
| No self-service disconnect/remove team member | Must do via admin or DB | Add "Remove team member" to admin UI |
| Admin `client_form.ejs` still shows SendGrid API key field | This is dead — Gmail API only now | Remove the field |

---

### Admin Panel — Settings Available Per Client

From `/admin/clients/:id/edit`, you can configure everything a client needs:

| Setting | What it does |
|---------|-------------|
| Client / Brokerage name | Display name, shown in daily report |
| Agent name | Used in `{{agent_name}}` template placeholder |
| Agent email | Primary identity; determines domain for auto-join |
| Agent phone | Used in `{{agent_phone}}` template placeholder |
| Buyer email template (subject + body) | Template for buyer leads |
| Seller email template (subject + body) | Template for seller leads |
| Buyer lead sender | Which team member's Gmail sends buyer emails |
| Seller lead sender | Which team member's Gmail sends seller emails |
| Fallback send-from email | Override if no per-type sender is set |
| CC email | Always CC'd on every outbound email |
| Send window start / end | Business hours (24h format, e.g. `08:30`) |
| Timezone | IANA timezone, e.g. `America/Chicago` |
| Daily send cap | Max emails per day per client |
| Team signature | Appends "Team Name Team" to every email |
| Active / Paused | Whether webhooks are processed |

---

## Part 3 — Onboarding a New Client (Step by Step)

### What You Need to Gather First

- Team name (e.g. "Marquis Farwell Homes")
- Primary agent name + email + phone
- Their website
- Which platform their leads come from (Luxury Presence, etc.)
- Whether they have multiple agents who should each send from their own Gmail

---

### Step 1 — Create the Client in Admin

1. Go to `/admin`
2. Click **New Client**
3. Fill out:
   - Client name, website
   - Agent name, email, phone
   - Buyer template subject + body (customize for their market)
   - Seller template subject + body
   - Send window (match their timezone and business hours)
   - Daily send cap (start at `10` for new clients)
4. Click **Create Client**

You'll land on `/admin/clients/:id` — copy the client UUID from the URL.

---

### Step 2 — Give the Agent Their Onboarding Link

Send the agent this message:

> "To get your lead responder running, open this link and click **Sign in with Google**:  
> https://leads.dmrmedia.org/onboarding  
>  
> Use the Gmail account you want leads to come FROM. It takes about 30 seconds. Google will ask for permission to send email — that's all we need.  
>  
> After connecting, your system is live. Let me know your email domain if you have team members who should also be connected."

**What happens when they connect:**
- If their email is already in our `users` table → tokens saved, dashboard opens
- If their email domain matches their `agent_email` domain → auto-added as team member
- If it's a brand-new email not in the system → a new client record is created (manual merge needed via admin if that happens by accident)

> ⚠️ If the agent connects before you create their client record, they'll get a new auto-created account. You can merge them manually: update `users.client_id` to the correct client UUID.

---

### Step 3 — Set the Webhook URL in Luxury Presence

The webhook URL for this client is:
```
https://leads.dmrmedia.org/v1/webhooks/incoming/[CLIENT-UUID]
```

In Luxury Presence admin:
1. Settings → Lead Routing (or CRM Integration)
2. Paste the webhook URL
3. Set method to POST, format to JSON

Test it with a dummy lead submission. You should see a new conversation appear in `/admin/clients/:id` within seconds.

---

### Step 4 — Connect Team Members (If Applicable)

If the team has more than one agent who should send emails:

1. Each additional agent goes to `https://leads.dmrmedia.org/onboarding` and signs in with their own Gmail
2. Since their email is at the same domain as the owner's `agent_email`, they're auto-joined as a `member`
3. Go to `/admin/clients/:id/edit`
4. Under **Designated Senders**, select:
   - Buyer lead sender → the agent who handles buyer leads
   - Seller lead sender → the agent who handles seller leads

---

### Step 5 — Verify It's Working

1. Go to `/admin/clients/:id` — status badge should show **Live** (green)
2. Check "Sender status" panel — all connected senders should show green dots
3. Send a test webhook with a fake lead (use the **Test Email** button in admin)
4. Within 15 minutes, check that the message appears as **Sent** in the feed
5. Confirm the email landed in the sender's Gmail Sent folder

---

## Part 4 — White-Label / Custom CRM Deployment

This software can be deployed as a white-labeled tool for another brokerage or tech company that wants to run it under their own brand.

### What Changes Per Deployment

Every deployed instance needs its **own Google Cloud project** with its own OAuth credentials. You cannot share one OAuth app across multiple independent brands — Google's verification is tied to a single app name and homepage.

**Environment variables to customize (Vercel):**

| Variable | What It Controls | Example |
|----------|-----------------|---------|
| `BRAND_NAME` | App name shown everywhere | `"Compass Lead Responder"` |
| `BRAND_TAGLINE` | Subtitle in the header | `"Automated Lead Response"` |
| `BRAND_DOMAIN` | Domain shown in footer / privacy policy | `"leads.compassagents.com"` |
| `GOOGLE_CLIENT_ID` | Their own Google Cloud project OAuth client | From their GCP console |
| `GOOGLE_CLIENT_SECRET` | Their OAuth secret | From their GCP console |
| `PUBLIC_BASE_URL` | The deployed app URL (sets OAuth redirect URI) | `"https://leads.compassagents.com"` |
| `ADMIN_SUPER_EMAIL` | Their admin email (gets admin session on connect) | `"admin@compassagents.com"` |
| `ENCRYPTION_KEY` | 64 hex chars, unique per deployment | Generate with `openssl rand -hex 32` |
| `DATABASE_URL` | Their own Neon/Postgres database | Separate DB per tenant |
| `CRON_SECRET` | Secret for Vercel cron authentication | Random string |

### Steps to Deploy for a New Brand

1. **Fork or clone** the repo to `dmrmediateam/[brand-name]-leadresponder`
2. **Create a new Neon database** for them — run `schema.sql` then `schema-v2.sql`
3. **Create a new Google Cloud project** under their Google Workspace
4. Enable **Gmail API** in that project
5. Create an **OAuth 2.0 Client ID** (Web application) with authorized redirect URI: `https://[their-domain]/auth/google/callback`
6. **Deploy to Vercel** with all the environment variables above set
7. Follow the **Google OAuth Verification steps (Part 1)** — they'll need their own verification under their own brand
8. Give them their admin credentials and onboarding link

### What's Shared vs. What's Isolated

| Component | Per-Brand |
|-----------|-----------|
| Database | ✅ Separate (each brand has their own Neon DB) |
| Google Cloud project + OAuth app | ✅ Separate |
| Encryption keys | ✅ Separate |
| Vercel deployment | ✅ Separate project |
| Codebase | Shared (same repo, different env vars) |
| Admin panel | Shared UI, separate data |

---

## Part 5 — Environment Variables Reference

Complete list of all environment variables for a production Vercel deployment:

```bash
# Required
DATABASE_URL=postgresql://...          # Neon connection string
GOOGLE_CLIENT_ID=...                   # OAuth 2.0 client ID from GCP console
GOOGLE_CLIENT_SECRET=...               # OAuth 2.0 client secret
ENCRYPTION_KEY=...                     # 64 hex chars (openssl rand -hex 32)
SESSION_SECRET=...                     # Random string for session signing
CRON_SECRET=...                        # Random string, must match Vercel cron header

# Required in production
PUBLIC_BASE_URL=https://leads.dmrmedia.org   # No trailing slash
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=...                     # Strong password

# Recommended
ADMIN_SUPER_EMAIL=team@dmrmedia.org    # Connects as super-admin, not a client
ADMIN_ALERT_EMAIL=max@dmrmedia.org     # Where alert emails go

# Brand (white-label)
BRAND_NAME=DMR Media
BRAND_TAGLINE=Lead Response Bridge
BRAND_DOMAIN=dmrmedia.org

# Optional
GMAIL_PUBSUB_TOPIC=...                 # For Gmail push notifications (future)
GMAIL_PUSH_VERIFICATION_TOKEN=...      # For Gmail push verification
DATABASE_POOL_MAX=3                    # Neon connection pool (keep at 3 for serverless)
```

---

## Quick Reference — Checklists

### New Client Launch Checklist
- [ ] Client record created in `/admin/clients/new`
- [ ] Agent connected Gmail via `/onboarding`
- [ ] Webhook URL added to their lead platform
- [ ] Test lead sent and confirmed as **Sent** in dashboard
- [ ] Sender status panel shows green for all senders
- [ ] `buyer_sender_email` set if using a team member other than owner
- [ ] `seller_sender_email` set if applicable
- [ ] Send window matches their timezone and business hours
- [ ] Daily send cap set appropriately

### Google OAuth Verification Checklist
- [ ] Privacy policy live at `/privacy`
- [ ] Terms of service live at `/terms`
- [ ] App homepage live at `/onboarding`
- [ ] OAuth consent screen filled out in GCP
- [ ] Three scopes added (gmail.send, userinfo.email, userinfo.profile)
- [ ] App published (Status = In production)
- [ ] Demo video recorded (~60 sec) and uploaded to YouTube (unlisted)
- [ ] Verification form submitted with scope justifications
- [ ] Awaiting Google response at `max@dmrmedia.org`

### Before Adding the 10th Client
- [ ] All existing clients have green sender health
- [ ] No "failed" messages older than 48 hours in admin feed
- [ ] Daily report arriving every morning to team@dmrmedia.org
- [ ] All connected users have token expiry > 30 days out
- [ ] Ghost accounts cleaned up (see Known Issues below)

---

## Known Issues (As of May 29, 2026)

| Issue | Impact | Action |
|-------|--------|--------|
| `samanthamarquishomes@gmail.com` — `connected=true`, no token | Confusing, not breaking | Delete from `users` table |
| Marquis `buyer_sender_email` not set | Buyer emails send from client-level token (Linda) by default | Set to `linda.farwell@compass.com` explicitly so it's intentional |
| Admin client form still has SendGrid API key field | UI noise — field is unused | Remove from `client_form.ejs` |
| Webhook URL not shown in client dashboard | Agents can't self-configure | Add to `/dashboard` |
