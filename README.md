# DMR Media — Lead Response Bridge

> **Self-serve email automation for real estate agents.** Agent signs in with Google, copies a webhook URL into their lead-gen tool (Luxury Presence, IDX, etc.), and from that moment every lead receives an instant, personalized follow-up sent **from the agent's own Gmail**.

**Production:** `https://email.dmrmedia.org`

---

## How it works in one screen

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  Agent visits  email.dmrmedia.org/onboarding                       │
│         │                                                          │
│         ▼                                                          │
│   Sign in with Google  (one click — uses their @gmail.com)         │
│         │                                                          │
│         ▼                                                          │
│   Client account auto-provisioned                                  │
│   Dashboard appears with their unique webhook URL                  │
│         │                                                          │
│         ▼                                                          │
│   Agent pastes URL into Luxury Presence webhook config             │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Lead submits form on agent's website                              │
│         │                                                          │
│         ▼                                                          │
│   POST email.dmrmedia.org/v1/webhooks/incoming/{client_uuid}       │
│         │                                                          │
│         ▼                                                          │
│   Lead normalized → template rendered → sent via Gmail API         │
│         │                                                          │
│         ▼                                                          │
│   Email lands in lead's inbox FROM agent@gmail.com                 │
│   Reply goes straight to agent's Gmail (no relay)                  │
│   Email is also in agent's Sent folder, exactly like they typed it │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Total time from lead-submit to email-sent: ~1–2 seconds.**

---

## Why Gmail API (not SendGrid)

Most of our clients use `@gmail.com` addresses. SendGrid (or any third-party SMTP) cannot legitimately send "from" `@gmail.com` because Gmail's DMARC policy is `p=reject` — those messages get rejected or spam-foldered.

The Gmail API uses Google's own mail servers, signs the message with Google's DKIM keys, and lands the message in **the agent's own Sent folder**. To the receiving inbox, it's literally identical to the agent typing the email on their phone. Best deliverability available, fully authentic, zero domain setup required.

Trade-off: each Gmail account is rate-limited (~500 sends/day for free Gmail, ~2000/day for Workspace). For lead follow-up volume this is plenty; if it ever isn't, we add a queue layer.

---

## Two surfaces

| URL | Audience | Auth | Purpose |
|---|---|---|---|
| `/onboarding` | Real estate agents (clients) | Public landing → Sign in with Google | Self-serve sign-up |
| `/dashboard` | Real estate agents (clients) | Google session cookie | Their webhook URL, template editor, send history |
| `/admin` | DMR Media operators | Username + password | See all clients, override anything, troubleshoot |

---

## Stack

| Layer | Tech |
|---|---|
| Server | Node.js 18+, Express |
| Database | SQLite (`better-sqlite3`) — Postgres-portable schema |
| Mail | Gmail API (`googleapis` SDK) |
| Auth (clients) | Google OAuth 2.0, refresh tokens encrypted at rest |
| Auth (admin) | HMAC-signed cookie session |
| Encryption | AES-256-GCM for stored tokens |
| Views | EJS, plain CSS, DMR Media branded |

---

## Local setup (5 min)

```bash
npm install
cp .env.example .env
# generate keys (run twice):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# paste once into ENCRYPTION_KEY, once into SESSION_SECRET in .env
# set ADMIN_PASSWORD in .env
# paste GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (from Google Cloud Console)

npm run migrate
npm run dev
```

Then:
- `http://localhost:3000/onboarding` → client self-signup flow
- `http://localhost:3000/admin` → DMR Media operator console

---

## Google Cloud Console setup (one-time)

1. <https://console.cloud.google.com> → create project (any name).
2. APIs & Services → Library → enable **Gmail API**.
3. APIs & Services → OAuth consent screen → External → fill in app info, add `dmrmedia.org` as authorized domain.
4. Add scopes: `https://www.googleapis.com/auth/gmail.send` + `https://www.googleapis.com/auth/userinfo.email` + `https://www.googleapis.com/auth/userinfo.profile`.
5. Add test users (every agent's `@gmail.com` until the app is published).
6. APIs & Services → Credentials → OAuth client ID (Web application) → redirect URIs:
   - `http://localhost:3000/auth/google/callback`
   - `https://email.dmrmedia.org/auth/google/callback`
7. Copy Client ID + Secret into `.env`.

> While the consent screen is in **Testing**, only listed test users can authorize. To onboard agents publicly, **publish** the consent screen (Google may require a verification step for sensitive scopes; `gmail.send` is sensitive).

---

## Webhook payload (what to POST to `/v1/webhooks/incoming/{client_uuid}`)

The normalizer accepts loose field naming:

| Internal field | Accepted source keys |
|---|---|
| `first_name` | `first_name`, `firstName`, `fname`, derived from `name` |
| `last_name` | `last_name`, `lastName`, `lname`, derived from `name` |
| `full_name` | `name`, `full_name`, `fullName`, `lead_name`, `contact_name` |
| `email` | `email`, `lead_email`, `contact_email`, `emailAddress` |
| `phone` | `phone`, `phone_number`, `phoneNumber`, `lead_phone`, `mobile` |
| `property_address` | `property_address`, `property_ref`, `address`, `listing_address`, `property` |
| `property_url` | `property_url`, `listing_url`, `url`, `property_link` |
| `message` | `message`, `notes`, `inquiry`, `comments`, `body` |

Curl test:
```bash
curl -X POST http://localhost:3000/v1/webhooks/incoming/<UUID> \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "555-0101",
    "property_address": "123 Beverly Dr, Beverly Hills, CA",
    "message": "Interested in this listing"
  }'
```

The endpoint returns `200 OK` immediately and dispatches asynchronously.

---

## Default template

```text
Subject:  Quick question about {{property_address}}

Hi {{first_name}},

Saw you were looking at {{property_address}} — wanted to reach out
personally and see if you have any questions, or if you'd like a
private tour this week.

What works best for you?

{{agent_name}}
{{agent_phone}}
```

Agents edit this in their dashboard. Plain text only (matches how agents actually type from their phones — best deliverability + most authentic).

---

## Deploying to email.dmrmedia.org

Reverse-proxy `email.dmrmedia.org` → `127.0.0.1:3000` (or whatever port you choose) via nginx/Caddy on the existing dmrmedia.org host. TLS terminates at the proxy.

Production env required (server refuses to boot otherwise):
- `ENCRYPTION_KEY` (64 hex chars)
- `SESSION_SECRET` (random)
- `ADMIN_PASSWORD` (not the dev default)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `PUBLIC_BASE_URL=https://email.dmrmedia.org`
- `NODE_ENV=production`

---

## Security

- Refresh tokens encrypted at rest with AES-256-GCM.
- OAuth state pinned to a one-shot cookie (CSRF protection).
- Admin and client sessions are separate HMAC-signed cookies, HttpOnly + SameSite=Lax + Secure in prod.
- No secrets returned in API responses, ever.
- `gmail.send` scope only — we cannot read inboxes.

---

## File map

```
server.js                           # Express entry
schema.sql                          # DB schema
ROADMAP.md                          # phased plan
src/
  config.js                         # env loader
  db.js                             # SQLite wrapper
  crypto.js                         # AES-256-GCM helpers
  middleware/auth.js                # admin + client session middleware
  repos/clients.js                  # client CRUD + token storage
  repos/leads.js                    # lead history
  routes/onboarding.js              # public landing + sign-in
  routes/oauth.js                   # /auth/google/start, /auth/google/callback
  routes/dashboard.js               # /dashboard (client-facing)
  routes/admin.js                   # /admin (DMR Media operators)
  routes/login.js                   # admin login
  routes/webhook.js                 # POST /v1/webhooks/incoming/:client_uuid
  services/google.js                # OAuth + Gmail API send
  services/template.js              # {{placeholder}} renderer
  services/leadNormalizer.js        # webhook payload → internal Lead
  services/dispatcher.js            # webhook → Gmail send pipeline
views/                              # EJS — DMR Media branded
public/css/dmr.css                  # CSS (rebrand by editing variables)
scripts/migrate.js                  # apply schema
```

See [ROADMAP.md](./ROADMAP.md) for phases and what's planned next.
