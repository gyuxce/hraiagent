-- =============================================================================
-- AI score breakdown + manual override (trust / calibration)
-- =============================================================================

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS ai_score_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS manual_score INTEGER
    CHECK (manual_score IS NULL OR (manual_score >= 0 AND manual_score <= 100)),
  ADD COLUMN IF NOT EXISTS manual_score_reason TEXT,
  ADD COLUMN IF NOT EXISTS manual_score_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN candidates.ai_score_breakdown IS
  'Structured AI rubric scores: must_have, skills, experience, education, extras + flags';
COMMENT ON COLUMN candidates.manual_score IS
  'Recruiter override. Effective score = COALESCE(manual_score, ai_score)';
