-- Studio image generation quota, independent of OpenRouter text-generation calls.
-- Images and original binary assets are stored privately in R2, not in D1.
CREATE TABLE IF NOT EXISTS studio_image_quota (
 day TEXT PRIMARY KEY,
 used INTEGER NOT NULL DEFAULT 0 CHECK(used >= 0)
);
