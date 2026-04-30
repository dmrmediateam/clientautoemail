-- DMR Media Lead Response Bridge — database schema
-- Compatible with SQLite (dev) and easily portable to Postgres.

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
  google_token_expiry             INTEGER,
  google_scope                    TEXT,
  google_email                    TEXT,
  active                          INTEGER NOT NULL DEFAULT 1,
  created_at                      INTEGER NOT NULL,
  updated_at                      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id           TEXT NOT NULL,
  raw_payload         TEXT NOT NULL,
  normalized_payload  TEXT NOT NULL,
  email_to            TEXT NOT NULL,
  email_from          TEXT NOT NULL,
  subject             TEXT NOT NULL,
  body                TEXT NOT NULL,
  status              TEXT NOT NULL,
  error               TEXT,
  message_id          TEXT,
  created_at          INTEGER NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
