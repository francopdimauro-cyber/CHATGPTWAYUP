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

-- Optional idempotent backfill: only previously completed pages.
INSERT OR IGNORE INTO webcreator_projects(id,name,html,source_job_key)
SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))),
       'Web recuperada · '||substr(created_at,1,10),html,cache_key
FROM generation_cache WHERE length(html)>40;
INSERT OR IGNORE INTO webcreator_projects(id,name,html,source_job_key)
SELECT lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))),
       'Web recuperada · '||substr(updated_at,1,10),partial_html,job_key
FROM generation_drafts
WHERE status='complete' AND instr(lower(partial_html),'</html>')>0;
INSERT OR IGNORE INTO webcreator_project_versions(project_id,version,html,label)
SELECT id,1,html,'Generación recuperada' FROM webcreator_projects;
