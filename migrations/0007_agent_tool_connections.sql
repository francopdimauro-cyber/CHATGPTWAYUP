-- Connector credentials are encrypted at rest by an independent Workers secret.
-- Only isolated previewchatgpt D1. Do not run against legacy or production databases.
CREATE TABLE IF NOT EXISTS studio_agent_connections (
 agent_id TEXT NOT NULL REFERENCES studio_agents(id) ON DELETE CASCADE,
 provider TEXT NOT NULL CHECK(provider IN ('gmail','whatsapp')),
 account_label TEXT NOT NULL DEFAULT '',
 access_cipher TEXT NOT NULL,
 refresh_cipher TEXT NOT NULL DEFAULT '',
 phone_id TEXT NOT NULL DEFAULT '',
 verify_hash TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(agent_id,provider)
);
CREATE UNIQUE INDEX IF NOT EXISTS studio_whatsapp_phone ON studio_agent_connections(provider,phone_id) WHERE provider='whatsapp' AND phone_id<>'';
CREATE TABLE IF NOT EXISTS studio_agent_action_audit (
 id TEXT PRIMARY KEY,
 agent_id TEXT NOT NULL REFERENCES studio_agents(id) ON DELETE CASCADE,
 action TEXT NOT NULL,
 outcome TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS studio_agent_action_audit_recent ON studio_agent_action_audit(agent_id,created_at DESC);
CREATE TABLE IF NOT EXISTS studio_whatsapp_messages (
 message_id TEXT PRIMARY KEY,
 agent_id TEXT NOT NULL REFERENCES studio_agents(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
