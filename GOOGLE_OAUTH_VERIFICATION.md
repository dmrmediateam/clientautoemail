# Google OAuth App Verification Guide

> **This is the technical reference for Google Cloud Console steps.**  
> For the full operational guide including client onboarding, white-label setup, and readiness checklists, see [dmr.md](dmr.md).

Your app only uses `gmail.send` — a **sensitive scope**, not a restricted one.  
This means **no security audit, no CASA assessment**. Just a form + a short video.

---

## Before You Start — What You Need Ready

1. **Production URL** — `https://leads.dmrmedia.org/onboarding` (the live Vercel app)
2. **Privacy Policy URL** — `https://leads.dmrmedia.org/privacy` ✅ (already built at `/privacy`)
3. **Terms of Service URL** — `https://leads.dmrmedia.org/terms` ✅ (already built at `/terms`)
4. **App logo** — a square PNG, at least 120×120px (DMR Media logo)
5. **A Google account** that owns the Google Cloud project — the one whose credentials are in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel
6. **A short screen recording** (~60 seconds) showing the OAuth flow — required by Google for sensitive scopes

---

## Step 1 — Open the OAuth Consent Screen

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project from the top dropdown
3. In the left sidebar: **APIs & Services → OAuth consent screen**

---

## Step 2 — Fill Out the App Information

Click **Edit App** (or start the form if not filled out yet).

| Field | What to Enter |
|---|---|
| App name | `DMR Media Lead Responder` |
| User support email | `max@dmrmedia.org` |
| App logo | Upload DMR logo (square PNG, 120×120 min) |
| App home page | `https://leads.dmrmedia.org/onboarding` |
| App privacy policy | `https://leads.dmrmedia.org/privacy` |
| App terms of service | `https://leads.dmrmedia.org/terms` |
| Authorized domains | `dmrmedia.org` |
| Developer contact email | `max@dmrmedia.org` |

Click **Save and Continue**.

---

## Step 3 — Configure Scopes

1. Click **Add or Remove Scopes**
2. Search for and add these three scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
3. Click **Update** then **Save and Continue**

---

## Step 4 — Add Test Users (temporary)

While in Testing mode, only these emails can connect. Add all accounts you need working **right now**:

- `max@dmrmedia.org`
- `team@dmrmedia.org`
- Any real estate agent accounts (e.g. `samantha.marquis@compass.com`)

Click **Save and Continue**.

---

## Step 5 — Publish the App (Do This Today)

> **This is the most important step.** It stops the 7-day refresh token expiry immediately — no more `invalid_grant` errors.

1. On the OAuth consent screen summary page, find the **Publishing Status** section
2. Click **Publish App**
3. Confirm when prompted

After this:
- Status changes from **Testing** to **In production**
- Anyone can connect their Gmail (not just test users)
- Refresh tokens no longer expire after 7 days
- Users will see an "unverified app" warning screen — that's OK for now, they can click **Advanced → Continue** to proceed

---

## Step 6 — Submit for Verification

> This removes the "unverified app" warning for end users. Takes 1–4 weeks.

### 6a — Record the Required Video (~60 seconds)

Google requires a screen recording showing:
1. Navigate to `https://leads.dmrmedia.org/onboarding` — show the homepage with the "Sign in with Google" button and the scope disclosure (`gmail.send`, never reads inbox)
2. Click **Sign in with Google**
3. The Google consent screen appears — pause so the reviewer can see all three scopes: `gmail.send`, email, profile
4. Approve it
5. Land on the client dashboard — show the **Live** status and "Sending via..." email address
6. (Recommended) Show a conversation in the feed with a green **Sent** badge — proves the scope is actively used

Upload the video to **YouTube** as **Unlisted** (not public). Copy the link.

### 6b — Submit the Verification Request

1. On the OAuth consent screen page, click **Prepare for Verification**
2. Fill in:
   - **YouTube link** to your demo video
   - **Explanation of how you use each scope** — copy this exactly:

**`gmail.send`:**
> "Used to send automated personalized lead-response emails on behalf of connected real estate agents. When a new buyer or seller lead is received via webhook from the agent's lead generation platform (e.g. Luxury Presence), the system sends a single outbound email from the agent's own Gmail address to that lead. The agent's email is never read; only the send permission is used."

**`userinfo.email`:**
> "Used to identify which Google account is being connected, associate it with the correct agent profile in our system, and display the connected email address in the agent's dashboard."

**`userinfo.profile`:**
> "Used to pre-fill the agent's display name when they first connect their account."

3. Click **Submit for Verification**

Google will email `max@dmrmedia.org` with any questions. Typical review time: 3–14 business days.

---

## What Happens After Verification

| Stage | User Experience |
|---|---|
| **Testing** (now) | Only test users listed can connect; tokens expire in 7 days |
| **Published, unverified** (after Step 5) | Anyone can connect; tokens don't expire; users see "unverified" warning |
| **Verified** (after Step 6, ~2–4 weeks) | Anyone can connect; no warning; normal Google consent screen |

---

## Common Questions

**Q: Do I need to re-connect everyone after publishing?**  
No. Existing tokens keep working. Only people whose tokens already expired need to reconnect.

**Q: What if Google asks for more info during review?**  
They'll email `max@dmrmedia.org`. Usually they ask for clarification on scope usage — describe what the app does honestly. The scope justification text above is pre-written for this.

**Q: Does the custom domain matter for verification?**  
Yes — Google will verify that your privacy policy and homepage are live and accessible from `leads.dmrmedia.org`. Make sure both URLs return 200 before submitting.

**Q: Can I stay "unverified" permanently?**  
Technically yes, but users will always see the scary warning screen. Fine for internal use (Marquis team) right now. Not acceptable for external real estate agents you're onboarding at scale.

**Q: What's the authorized redirect URI in GCP?**  
Exactly: `https://leads.dmrmedia.org/auth/google/callback`  
This is set automatically by `config.js` using `PUBLIC_BASE_URL`. If you add a custom domain in Vercel, update `PUBLIC_BASE_URL` and add the new redirect URI to the GCP OAuth client.

**Q: For white-label deployments — do they need their own verification?**  
Yes. Each brand needs its own Google Cloud project, OAuth app, and goes through the same verification process under their own app name and domain. See [dmr.md — Part 4](dmr.md#part-4--white-label--custom-crm-deployment) for the full white-label setup guide.
