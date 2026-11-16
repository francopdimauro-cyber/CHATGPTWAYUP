-- Preview de Studio exclusivamente: agentes aislados de Agent Builder original.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS studio_agents (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 role TEXT NOT NULL,
 objective TEXT NOT NULL,
 instructions TEXT NOT NULL,
 knowledge TEXT NOT NULL DEFAULT '',
 tools_json TEXT NOT NULL DEFAULT '["text_generation"]',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS studio_agents_owner ON studio_agents(owner_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS studio_public_chats (
 id TEXT PRIMARY KEY,
 agent_id TEXT NOT NULL REFERENCES studio_agents(id) ON DELETE CASCADE,
 origin TEXT NOT NULL,
 title TEXT NOT NULL,
 greeting TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 daily_limit INTEGER NOT NULL DEFAULT 200 CHECK(daily_limit BETWEEN 1 AND 300),
 per_visitor_limit INTEGER NOT NULL DEFAULT 12 CHECK(per_visitor_limit BETWEEN 1 AND 20),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(agent_id,origin)
);
CREATE INDEX IF NOT EXISTS studio_public_chats_agent ON studio_public_chats(agent_id);
CREATE TABLE IF NOT EXISTS studio_chat_usage (
 chat_id TEXT NOT NULL REFERENCES studio_public_chats(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 visitor_hash TEXT NOT NULL,
 used INTEGER NOT NULL DEFAULT 0 CHECK(used >= 0),
 PRIMARY KEY (chat_id,day,visitor_hash)
);
CREATE TABLE IF NOT EXISTS studio_chat_daily (
 chat_id TEXT NOT NULL REFERENCES studio_public_chats(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 used INTEGER NOT NULL DEFAULT 0 CHECK(used >= 0),
 PRIMARY KEY (chat_id,day)
);
CREATE TABLE IF NOT EXISTS studio_agent_leads (
 id TEXT PRIMARY KEY,
 agent_id TEXT NOT NULL REFERENCES studio_agents(id) ON DELETE CASCADE,
 chat_id TEXT NOT NULL REFERENCES studio_public_chats(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 message TEXT NOT NULL,
 consent INTEGER NOT NULL DEFAULT 1 CHECK(consent=1),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS studio_agent_leads_agent ON studio_agent_leads(agent_id,created_at DESC);
