CREATE TABLE scene_settings (
  scope TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO scene_settings (scope, payload)
VALUES ('site', '{}'::jsonb)
ON CONFLICT (scope) DO NOTHING;
