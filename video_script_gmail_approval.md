# Gmail API Approval — Full Submission Guide

**App:** DMR Media Lead Response Bridge  
**Scope:** `gmail.send` (sensitive, NOT restricted — no security audit needed)  
**Live URL:** https://email.dmrmedia.org  
**Likely approval:** Yes — legitimate use case, minimal scope, clean policies

---

## Pre-Flight Checklist

Before touching Google Console, confirm these are done:

- [ ] **Vercel env var** `PUBLIC_BASE_URL=https://email.dmrmedia.org` is set in Vercel → Settings → Environment Variables
- [ ] Visit `https://email.dmrmedia.org/privacy` — confirms it loads
- [ ] Visit `https://email.dmrmedia.org/terms` — confirms it loads
- [ ] Have a **square logo PNG** ready (120×120px minimum — DMR Media logo)
- [ ] Logged into Google Cloud Console with the account that owns the OAuth credentials

---

## Step 1 — Open Google Cloud Console

1. Go to **https://console.cloud.google.com**
2. Select your project from the top dropdown
3. Left sidebar: **APIs & Services → OAuth consent screen**
4. Click **Edit App**

---

## Step 2 — Fill In App Information

Paste these values exactly:

| Field | Value |
|---|---|
| App name | `DMR Media Lead Response Bridge` |
| User support email | `max@dmrmedia.org` |
| App logo | Upload square PNG (120×120px min) |
| Homepage URL | `https://email.dmrmedia.org` |
| Privacy policy URL | `https://email.dmrmedia.org/privacy` |
| Terms of service URL | `https://email.dmrmedia.org/terms` |
| Authorized domain 1 | `dmrmedia.org` |
| Developer contact email | `max@dmrmedia.org` |

Click **Save and Continue**.

---

## Step 3 — Add Scopes

1. Click **Add or Remove Scopes**
2. Add these three (search by name):
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
3. Click **Update** → **Save and Continue**

**Scope justification text** (paste into the explanation box for `gmail.send`):

> Real estate agents connect their Gmail account so the app can automatically send a personalized reply to new buyer and seller leads the moment they submit an inquiry. The app uses `gmail.send` to send one outbound email per lead on the agent's behalf. The app never reads, modifies, or accesses any existing emails in the user's inbox or any other folder. Agents can revoke access at any time from their dashboard.

---

## Step 4 — Add Test Users

Add all accounts that need to work right now:

- `max@dmrmedia.org`
- `team@dmrmedia.org`
- Any agent accounts (e.g. `samantha.marquis@compass.com`)

Click **Save and Continue**.

---

## Step 5 — PUBLISH THE APP (Do This First — Most Important)

> This immediately stops the 7-day refresh token expiry. No more `invalid_grant` errors.

1. On the consent screen summary page, find **Publishing Status**
2. Click **Publish App**
3. Confirm

Status changes from **Testing → In production**.  
Users will see an "unverified app" warning for now — they can click **Advanced → Continue** to get past it. That goes away after verification is approved.

---

## Step 6 — Record the Video

### What to record (~60 seconds total)

Open a screen recorder (OBS, Loom, QuickTime, or Windows Game Bar `Win+G`).

**Shot-by-shot:**

| Time | What to show on screen | What to say |
|---|---|---|
| 0–5s | Navigate to `https://email.dmrmedia.org` — show the login page | *"This is the DMR Media Lead Response Bridge — a tool for real estate agents to automatically reply to new leads."* |
| 5–15s | Log in with `max@dmrmedia.org`, show the main dashboard | *"After logging in, agents see their dashboard with campaigns and lead history."* |
| 15–25s | Navigate to Settings or Onboarding — show the **Connect Gmail** button | *"To get started, an agent connects their Gmail account by clicking Connect Gmail."* |
| 25–40s | Click **Connect Gmail** — let the Google OAuth consent screen appear. Pause so the viewer can clearly read **"Send email on your behalf"** | *"Google's consent screen shows exactly what we're asking for — just the ability to send email on the agent's behalf. Nothing else."* |
| 40–50s | Click **Allow** — show it redirects back and confirms the account is connected | *"Once authorized, the agent's Gmail account is connected and ready."* |
| 50–60s | Show the Campaigns page or a sent message in the lead history | *"From here, whenever a new lead comes in, the app sends one personalized email to that lead using the connected Gmail account — automatically."* |

### After recording

- Upload to **YouTube** as **Unlisted**
- Copy the video URL — you'll paste it into the Google form

---

## Step 7 — Submit for Verification

1. Back in Google Cloud Console → OAuth consent screen
2. Click **Prepare for Verification** (only appears after publishing in Step 5)
3. Fill in:
   - **YouTube demo video URL** → paste your unlisted link
   - **How does your app use the `gmail.send` scope?** → paste the justification text from Step 3
4. Click **Submit for Verification**

Google will email `max@dmrmedia.org` within a few days with any questions or to confirm approval.  
Typical timeline: **1–4 weeks**.

---

## What Changes After Each Step

| Stage | Token expiry | User sees |
|---|---|---|
| Testing (now) | 7 days — causes `invalid_grant` | Only test users can connect |
| Published, unverified (after Step 5) | Never expires | "Unverified app" warning — can click through |
| Verified (after Step 7 approved) | Never expires | Normal Google consent screen, no warning |

---

## FAQ

**Q: Do existing connected accounts need to reconnect after publishing?**  
No. Existing tokens stay valid. Only accounts with already-expired tokens (like Samantha) need to reconnect.

**Q: What if Google asks a follow-up question during review?**  
They'll email `max@dmrmedia.org`. Usually just: *"explain how you use gmail.send"* — one reply with the justification text above is enough.

**Q: What if I don't have a logo right now?**  
Skip it — the logo is optional. You can add it later without re-submitting.

**Q: Does my Vercel domain need to be added as an authorized domain too?**  
Only if your `PUBLIC_BASE_URL` points to Vercel. Since you're using `email.dmrmedia.org`, just `dmrmedia.org` is enough.
