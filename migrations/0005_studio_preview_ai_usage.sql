-- Cuotas para el generador IA de la PREVIEW. No ejecutar en la D1 de producción.
CREATE TABLE IF NOT EXISTS studio_preview_ai_daily (
  owner_id TEXT NOT NULL,
  day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (owner_id, day)
);
CREATE INDEX IF NOT EXISTS studio_preview_ai_daily_day
  ON studio_preview_ai_daily(day);
