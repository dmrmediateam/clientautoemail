# Google OAuth App Verification Guide

Your app only uses `gmail.send` — a **sensitive scope**, not a restricted one.  
This means **no security audit, no CASA assessment**. Just a form + a short video.

---

## Before You Start — What You Need Ready

1. **Production URL** — your live Vercel app (e.g. `https://clientautoemail.vercel.app` or your custom domain)
2. **Privacy Policy URL** — `https://yourcustomdomain.com/privacy` (already built)
3. **Terms of Service URL** — `https://yourcustomdomain.com/terms` (already built)
4. **App logo** — a square PNG, at least 120×120px (e.g. DMR Media logo)
5. **A Google account** that owns the Google Cloud project (the one with the OAuth credentials)
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
| App name | `DMR Media Client Email` (or similar) |
| User support email | `max@dmrmedia.org` |
| App logo | Upload your logo (square PNG, 120×120 min) |
| App home page | `https://yourcustomdomain.com` |
| App privacy policy | `https://yourcustomdomain.com/privacy` |
| App terms of service | `https://yourcustomdomain.com/terms` |
| Authorized domains | `dmrmedia.org` AND your Vercel domain |
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
1. Navigate to your app's login/connect page
2. Click "Connect Gmail" (the OAuth button)
3. The Google consent screen appears showing the scopes (`gmail.send`, email, profile)
4. Approve it
5. Show that the app uses it to send an email

Upload the video to **YouTube** (can be unlisted).

### 6b — Submit the Verification Request

1. On the OAuth consent screen page, click **Prepare for Verification**
2. Fill in:
   - **YouTube link** to your demo video
   - **Explanation of how you use each scope:**
     - `gmail.send` → "Used to send automated buyer outreach emails on behalf of connected real estate agents to their leads"
     - `userinfo.email` → "Used to identify which Google account is being connected"
     - `userinfo.profile` → "Used to display the connected account's name in the dashboard"
3. Click **Submit for Verification**

Google will email you at the developer contact address with any questions.

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
No. Existing tokens keep working. Only people whose tokens expired (like Samantha) need to reconnect.

**Q: What if Google asks for more info during review?**  
They'll email `max@dmrmedia.org`. Usually they ask for clarification on scope usage — just describe what the app does honestly.

**Q: Does the custom domain matter for verification?**  
Yes — Google will verify that your privacy policy and homepage are live and accessible. Make sure the links work before submitting.

**Q: Can I stay "unverified" permanently?**  
Technically yes, but users will always see the scary warning. Fine for internal use; not ideal for external real estate agents.
