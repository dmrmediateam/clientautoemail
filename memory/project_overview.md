---
name: Lead Response Bridge project
description: What this repo is — a multi-tenant webhook→OAuth→SendGrid email middleware deployed at email.dmrmedia.org for DMR Media's clients
type: project
---

DMR Media is building a "Lead Response Bridge": a Node.js service that receives Luxury Presence webhooks and instantly sends personalized follow-up emails from the agent's own Gmail identity (via OAuth) through SendGrid.

**Why:** DMR Media wants to offer this as a paid service to real estate clients. First two clients onboarded; first confirmed is Marquis Farwell Homes (marquisfarwellhomes.com). The pitch is "instant, human-feeling follow-up" — agent doesn't have to lift a finger, lead gets a reply in seconds.

**How to apply:**
- Deploy target is `email.dmrmedia.org` (subdomain of existing dmrmedia.org Node.js site, but as a SEPARATE service, not merged into the main site).
- Multi-tenant by design — each client gets a unique webhook URL, their own OAuth-connected Gmail, their own template.
- Branding is DMR Media (operator), not the client — agents/clients do NOT log into this; DMR Media manages it for them.
- Plain-text emails only (deliverability + "human" feel per spec).
