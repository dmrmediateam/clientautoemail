-- Lead Response Platform v2 schema additions.
-- This file is intentionally additive; run scripts/migrate-v2.js for rollout.

CREATE TABLE IF NOT EXISTS client_settings (
  client_id                        TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  send_window_start                TEXT NOT NULL DEFAULT '08:30',
  send_window_end                  TEXT NOT NULL DEFAULT '18:00',
  timezone                         TEXT NOT NULL DEFAULT 'America/Chicago',
  daily_send_limit                 INTEGER NOT NULL DEFAULT 5,
  buyer_template_subject           TEXT NOT NULL DEFAULT 'Question about {{property_address}}',
  buyer_template_body              TEXT NOT NULL DEFAULT '',
  seller_template_subject          TEXT NOT NULL DEFAULT 'Question about your home at {{property_address}}',
  seller_template_body             TEXT NOT NULL DEFAULT '',
  created_at                       BIGINT NOT NULL,
  updated_at                       BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id                               BIGSERIAL PRIMARY KEY,
  client_id                        TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_email                       TEXT NOT NULL,
  lead_name                        TEXT,
  lead_phone                       TEXT,
  lead_type                        TEXT NOT NULL DEFAULT 'buyer',
  property_address                 TEXT,
  source                           TEXT,
  status                           TEXT NOT NULL DEFAULT 'active',
  thread_id                        TEXT,
  last_message_at                  BIGINT NOT NULL,
  created_at                       BIGINT NOT NULL,
  updated_at                       BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id                               BIGSERIAL PRIMARY KEY,
  conversation_id                  BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  client_id                        TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  direction                        TEXT NOT NULL,
  channel                          TEXT NOT NULL DEFAULT 'email',
  from_email                       TEXT NOT NULL,
  to_email                         TEXT NOT NULL,
  subject                          TEXT NOT NULL,
  body                             TEXT NOT NULL,
  gmail_message_id                 TEXT,
  gmail_thread_id                  TEXT,
  internet_message_id              TEXT,
  status                           TEXT NOT NULL,
  error                            TEXT,
  scheduled_for                    BIGINT,
  sent_at                          BIGINT,
  raw_payload                      TEXT,
  created_at                       BIGINT NOT NULL
);
