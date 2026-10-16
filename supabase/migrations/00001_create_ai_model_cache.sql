CREATE TABLE IF NOT EXISTS ai_model_cache (
  id TEXT PRIMARY KEY DEFAULT 'gemini_model',
  model_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ai_model_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role full access on ai_model_cache" ON ai_model_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
