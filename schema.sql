-- DMR Media Lead Response Bridge — Postgres schema

CREATE TABLE IF NOT EXISTS clients (
  id                              TEXT PRIMARY KEY,
  name                            TEXT NOT NULL,
  website                         TEXT,
  agent_name                      TEXT NOT NULL,
  agent_email                     TEXT NOT NULL,
  agent_phone                     TEXT,
  sendgrid_api_key_encrypted      TEXT,
  template_subject                TEXT NOT NULL DEFAULT 'Question about {{property_address}}',
  template_body                   TEXT NOT NULL,
  google_access_token_encrypted   TEXT,
  google_refresh_token_encrypted  TEXT,
  google_token_expiry             BIGINT,
  google_scope                    TEXT,
  google_email                    TEXT,
  active                          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                      BIGINT NOT NULL,
  updated_at                      BIGINT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS leads (
  id                  BIGSERIAL PRIMARY KEY,
  client_id           TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  raw_payload         TEXT NOT NULL,
  normalized_payload  TEXT NOT NULL,
  email_to            TEXT NOT NULL,
  email_from          TEXT NOT NULL,
  subject             TEXT NOT NULL,
  body                TEXT NOT NULL,
  status              TEXT NOT NULL,
  error               TEXT,
  message_id          TEXT,
  created_at          BIGINT NOT NULL
);

-- Multi-user: maps individual Google accounts to a client account.
-- role = 'owner'  → connects Gmail for sending, sees dashboard
-- role = 'member' → dashboard access only, does not overwrite sending credentials
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,   -- stored lowercase
  name         TEXT,
  client_id    TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member',
  created_at   BIGINT NOT NULL,
  updated_at   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);

CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_clients_google_email_lower ON clients(LOWER(google_email));
CREATE INDEX IF NOT EXISTS idx_clients_agent_email_lower ON clients(LOWER(agent_email));
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_email ON conversations(client_id, LOWER(lead_email));
CREATE INDEX IF NOT EXISTS idx_conversations_thread_id ON conversations(client_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_status_scheduled ON messages(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_gmail_message_id_unique ON messages(gmail_message_id) WHERE gmail_message_id IS NOT NULL;
