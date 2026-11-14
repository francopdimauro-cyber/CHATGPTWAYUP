-- WebCreator Studio: catálogo privado de proyectos y versiones HTML.
-- No modifica las tablas de generación, recuperación o cuota.
CREATE TABLE IF NOT EXISTS webcreator_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  html TEXT NOT NULL,
  source_job_key TEXT UNIQUE,
  current_version INTEGER NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_webcreator_projects_updated
  ON webcreator_projects(archived, updated_at DESC);
CREATE TABLE IF NOT EXISTS webcreator_project_versions (
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  html TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Guardado manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(project_id, version),
  FOREIGN KEY(project_id) REFERENCES webcreator_projects(id)
);
