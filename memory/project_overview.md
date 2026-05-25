---
name: Lead Response Bridge project
description: Multi-tenant webhook→Gmail API email automation deployed at email.dmrmedia.org for DMR Media's real estate clients
type: project
---

DMR Media is building a "Lead Response Bridge": a Node.js/Express service that receives Luxury Presence (and other CRM) webhooks and instantly sends personalized follow-up emails from the agent's own Gmail identity via OAuth + Gmail API directly. No SendGrid — email is sent with `gmail.send` scope, arrives from the agent's actual inbox, Google-signed DKIM.

**Why:** DMR Media wants to offer this as a paid service to real estate clients. First two clients onboarded; first confirmed is Marquis Farwell Homes (marquisfarwellhomes.com). The pitch is "instant, human-feeling follow-up" — agent doesn't have to lift a finger, lead gets a reply in seconds.

**Architecture:**
- Deploy target is Vercel (serverless), backed by Neon Postgres.
- Multi-tenant by design — each client gets a unique webhook URL, their own OAuth-connected Gmail, their own template.
- Smart send window — messages queued and sent during business hours per client timezone.
- Multi-level sender fallback: primary → other team members → team@dmrmedia.org.
- Tokens encrypted at rest (AES-256-GCM). Scope: `gmail.send` only.
- Plain-text emails only (deliverability + "human" feel per spec).
