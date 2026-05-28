# Client Software — How Teams Join & How the System Works

> Living reference doc. Last updated: May 28, 2026.

---

## Overview

`clientautoemail` is a multi-tenant automated email platform. Each real-estate team (client) has:
- One **client record** — owns the sending identity, webhook URL, and per-campaign settings
- One or more **user records** — team members who each connect their own Gmail via OAuth
- One **client_settings record** — controls which person sends buyer emails, which sends seller emails, send windows, templates, and more

---

## Database Structure

```
clients                         ← one row per team
  id (UUID)
  name                          ← team display name, e.g. "Marquis Real Estate"
  agent_email                   ← owner's email; used to identify the team
  agent_name                    ← shown in email templates as {{agent_name}}
  google_refresh_token_encrypted← client-level fallback OAuth token (AES-256-GCM)
  google_email                  ← email address the client-level token belongs to
  active (boolean)

users                           ← team members, each with their own Gmail token
  id (UUID)
  email                         ← lowercase; unique; used as login identity
  name
  client_id → clients.id        ← NULL for admin/system users only
  role                          ← 'owner' | 'member' | 'admin'
  google_connected (boolean)
  google_refresh_token_encrypted← per-user OAuth token (AES-256-GCM)
  google_token_expiry

client_settings                 ← one row per client, all campaign config
  client_id → clients.id
  buyer_sender_email            ← who sends buyer lead emails
  seller_sender_email           ← who sends seller lead emails
  send_from_email               ← generic fallback if above are empty
  buyer_template_subject/body
  seller_template_subject/body
  send_window_start / end       ← e.g. "08:30" / "18:00"
  timezone                      ← e.g. "America/Chicago"
  daily_send_limit
  cc_email
  buyer_paused / seller_paused  ← pause a campaign without deleting it
```

---

## How a Team Joins — OAuth Flow

All onboarding happens at `/onboarding` → clicking "Connect Gmail" → `/oauth/google/start`.

The callback at `/oauth/google/callback` (`src/routes/oauth.js`) runs **four checks in order**:

### 1. Super-admin (team@dmrmedia.org)
```
email === config.admin.superAdminEmail
→ issue admin session
→ save tokens to admin user row (allows team@ to send daily reports)
→ redirect /admin
```

### 2. Known user (already in `users` table)
```
findUserByEmail(email) returns a row
→ find the client this user belongs to
→ if role === 'owner': also save tokens to the clients row (client-level fallback)
→ save tokens to users row (per-user sending)
→ redirect /dashboard
```
This is the normal re-connect flow — a team member whose token expired hits "Connect Gmail" and lands here.

### 3. Domain auto-join (same email domain as an existing client's agent_email)
```
email not in users table
email domain matches an existing client's agent_email domain
→ upsertUser({ role: 'member' }) — auto-add to that team
→ save tokens to users row
→ redirect /dashboard
```
Example: if `samantha.marquis@compass.com` is the owner, then any `@compass.com` address that connects is automatically added to the Marquis team as a member.

**This is the main way new team members join — no invite needed, just connect Gmail with your work email.**

### 4. Brand-new client
```
email not in users, no matching domain
→ create new clients row (agent_email = this email)
→ upsertUser({ role: 'owner' })
→ save tokens to both clients row and users row
→ redirect /dashboard
```

**Full flow diagram:**
```
/onboarding
    ↓  (click Connect Gmail)
/oauth/google/start  →  Google OAuth consent screen
    ↓  (Google redirects back)
/oauth/google/callback
    ├─ super-admin?        → admin session + token save
    ├─ known user?         → token save + dashboard
    ├─ domain match?       → auto-join as member + dashboard
    └─ brand new?          → create client + owner user + dashboard
```

---

## Marquis Team — Real Example

| User | Email | Role | Status |
|------|-------|------|--------|
| Linda Farwell | linda.farwell@compass.com | owner | ✅ connected |
| Samantha Marquis | samantha.marquis@compass.com | member | ✅ connected |
| (ghost) | samanthamarquishomes@gmail.com | member | ⚠️ token=NULL |

Both Linda and Sam joined via domain auto-join (`@compass.com` domain matched Linda's `agent_email`).

**Current sender routing for Marquis:**

| Lead Type | Setting | Resolves To | Token |
|-----------|---------|-------------|-------|
| Seller | `seller_sender_email = samantha.marquis@compass.com` | Sam's user row | ✅ |
| Buyer | `buyer_sender_email = (empty)` | → client-level fallback → Linda | ✅ |

---

## How a Lead Gets Processed

```
Google Ads lead form submits
    ↓
POST /webhook/incoming/:client_uuid   (src/routes/webhook.js)
    ↓
dispatcher.processLead()              (src/services/dispatcher.js)
    ├─ normalize the raw payload (leadNormalizer.js)
    ├─ check skip rules (source filters)
    ├─ check campaign pause flags (buyer_paused / seller_paused)
    ├─ render email template ({{first_name}}, {{property_address}}, etc.)
    ├─ calculate send window (nextWindowStart — 08:30–18:00 local time)
    └─ insert message with status = 'queued', scheduled_for = next window
```

The lead is **not sent immediately**. It sits in the `messages` table as `queued`.

---

## How Queued Messages Get Sent — Cron

Vercel runs a cron every 15 minutes that hits `GET /api/cron/send-queued` (configured in `vercel.json`).

**Sender resolution logic** (`src/routes/cron.js`, `router.get('/send-queued')`):

```javascript
const leadType = conv.lead_type || 'buyer';

// Step 1: pick designated sender for this lead type
const perTypeSender = leadType === 'seller'
  ? (client.settings?.seller_sender_email || '')
  : (client.settings?.buyer_sender_email || '');

// Step 2: fall back to generic send_from_email
const sendFromEmail = perTypeSender || client.settings?.send_from_email || '';

if (sendFromEmail) {
  // Step 3: find that person in the team's users list
  const teamUsers = await clientsRepo.listUsersForClient(client.id);
  const senderUser = teamUsers.find(u =>
    u.email.toLowerCase() === sendFromEmail.toLowerCase() && u.connected
  );

  if (senderUser) {
    // Step 4a: send via their personal OAuth token
    result = await google.sendAsUserRow(senderUser, ...);
  } else {
    // Step 4b: designated sender disconnected — fall back to client-level token
    result = await google.sendAsClient(client, ...);
  }
} else {
  // Step 4c: no sender configured at all — client-level token
  result = await google.sendAsClient(client, ...);
}
```

**Fallback chain in plain English:**
```
seller lead → seller_sender_email (Sam) → Sam's user token
                                        → Sam disconnected? → client token (Linda)
                                        → seller_sender_email empty? → client token

buyer lead  → buyer_sender_email (empty for Marquis right now)
                                        → send_from_email (also empty)
                                        → client token (Linda, set at onboarding)
```

---

## How Sending Works — Gmail API

Every send goes through `src/services/google.js` using the Gmail API directly (`gmail.send` scope only — no `gmail.modify`, no SMTP).

Two send paths:
- **`sendAsUserRow(userRow, ...)`** — uses the individual team member's OAuth token from the `users` table
- **`sendAsClient(client, ...)`** — uses the client-level OAuth token from the `clients` table

All tokens are stored AES-256-GCM encrypted at rest. The encryption key is `ENCRYPTION_KEY` in the Vercel environment. Access tokens are refreshed automatically using the stored refresh token before each send.

---

## Token Storage — Two Places

| Where | What it is | Used for |
|-------|-----------|---------|
| `clients.google_refresh_token_encrypted` | Client-level token (set at onboarding, or by owner re-connecting) | Last-resort fallback when `sendAsClient()` is called |
| `users.google_refresh_token_encrypted` | Per-user token, one per team member | Primary send path via `sendAsUserRow()` |

When an owner connects Gmail, their token is written to **both** places. A member's connect only writes to `users`.

---

## Cron Schedule (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/send-queued", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/daily-report", "schedule": "0 13 * * *" }
  ]
}
```

- **send-queued** — runs every 15 minutes, sends all messages whose `scheduled_for <= now()`
- **daily-report** — runs at 1:00 PM UTC, sends a system status email to team@dmrmedia.org

---

## What Is and Isn't Sustainable

### Works well at current scale
- One client, 2–3 team members, ~10–50 leads/month per client → completely fine
- Domain auto-join means zero friction for adding a new team member
- Per-type sender routing means Sam handles sellers, Linda handles buyers independently

### Known limitations to plan for

**1. One designated sender per lead type**
`buyer_sender_email` and `seller_sender_email` are single email fields. If you want two agents splitting buyer leads, the system currently cannot round-robin between them. That requires v1.2 Campaigns (where each campaign has its own sender).

**2. Implicit fallback is silent**
If Sam's token expires, seller emails fall back to the client token without any alert — they just come from the wrong address. The daily report shows `failed` counts but not quiet fallback-sends. Solution: set up `buyer_sender_email` so every lead type has an explicit owner and the fallback is only a true emergency path.

**3. Gmail per-account send limits**
~500 emails/day per Gmail account. At current volume this is irrelevant. At scale (multiple active clients each with 50+ leads/day), this requires either multiple senders per client or v1.2 campaign architecture.

**4. Ghost user account**
`samanthamarquishomes@gmail.com` exists in `users` with `google_connected = true` but `google_refresh_token_encrypted = NULL`. Not currently pointed at by any sender setting, but should be cleaned up to avoid confusion.

---

## How to Add a New Team Member

1. Give them the onboarding URL: `https://[your-domain]/onboarding`
2. They click **Connect Gmail** and sign in with their work email
3. If their email domain matches an existing client's `agent_email` domain → automatically added as `member`
4. If not → a new standalone client account is created for them
5. After connecting, go to `/admin` → client settings → set `buyer_sender_email` or `seller_sender_email` to their email if they should be the designated sender

---

## How to Set Sender Routing (Admin)

In the admin panel (`/admin` → client → edit settings), or directly via SQL:

```sql
-- Set who sends buyer lead emails for a client
UPDATE client_settings
SET buyer_sender_email = 'linda.farwell@compass.com'
WHERE client_id = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';

-- Set who sends seller lead emails
UPDATE client_settings
SET seller_sender_email = 'samantha.marquis@compass.com'
WHERE client_id = 'ae5ebc7b-3ea3-45de-a0a6-98066037d937';
```

The designated sender must have a connected Google account in the `users` table. If they disconnect, the system falls back to the client-level token automatically.

---

## Key File Map

| File | Purpose |
|------|---------|
| `src/routes/oauth.js` | Google OAuth: login, callback, domain auto-join, new client creation |
| `src/routes/webhook.js` | Receives incoming leads from Google Ads / form providers |
| `src/routes/cron.js` | `GET /send-queued` and `GET /daily-report` — triggered by Vercel cron |
| `src/services/dispatcher.js` | Normalizes a lead, renders template, schedules message |
| `src/services/google.js` | Gmail API: `sendAsUserRow`, `sendAsClient`, token refresh |
| `src/repos/clients.js` | Client and user CRUD; `listUsersForClient`, `findClientByEmailDomain` |
| `src/repos/clientSettings.js` | All per-client campaign settings: senders, windows, templates |
| `src/services/leadNormalizer.js` | Maps raw webhook payloads to normalized lead objects |
| `vercel.json` | Cron schedule definitions |
