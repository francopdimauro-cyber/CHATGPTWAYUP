-- Preview únicamente: ejecutar en STUDIO_DB dedicado, nunca sobre USAGE_DB producción.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS studio_next_projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1 CHECK(current_version >= 1),
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS studio_next_versions (
  project_id TEXT NOT NULL REFERENCES studio_next_projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK(version >= 1),
  object_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id,version)
);

CREATE INDEX IF NOT EXISTS studio_next_projects_owner_updated
  ON studio_next_projects(owner_id,deleted,updated_at DESC);
