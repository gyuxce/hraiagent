-- =============================================================================
-- AI usage metering — fondasi kuota / pricing per agency per bulan
-- Jalankan SELURUH file ini sekali (jangan partial select).
-- =============================================================================

ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS ai_quota_monthly INTEGER NOT NULL DEFAULT 200
    CHECK (ai_quota_monthly >= 0);

COMMENT ON COLUMN agencies.plan_tier IS 'starter | growth | scale (label pricing; kuota di ai_quota_monthly)';
COMMENT ON COLUMN agencies.ai_quota_monthly IS 'Total unit AI billable per bulan kalender (UTC)';

CREATE TABLE IF NOT EXISTS agency_usage_monthly (
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  year_month CHAR(7) NOT NULL,
  total_units INTEGER NOT NULL DEFAULT 0 CHECK (total_units >= 0),
  cv_screen_count INTEGER NOT NULL DEFAULT 0,
  interview_summary_count INTEGER NOT NULL DEFAULT 0,
  async_question_gen_count INTEGER NOT NULL DEFAULT 0,
  async_analyze_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, year_month)
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'cv_screen',
      'interview_summary',
      'async_question_gen',
      'async_analyze'
    )
  ),
  units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  resource_type TEXT,
  resource_id UUID,
  model TEXT,
  year_month CHAR(7) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_agency_month
  ON ai_usage_events (agency_id, year_month, created_at DESC);

ALTER TABLE agency_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agency usage monthly" ON agency_usage_monthly;
CREATE POLICY "Users can view own agency usage monthly"
  ON agency_usage_monthly FOR SELECT
  USING (agency_id = get_user_agency_id());

DROP POLICY IF EXISTS "Users can view own agency ai events" ON ai_usage_events;
CREATE POLICY "Users can view own agency ai events"
  ON ai_usage_events FOR SELECT
  USING (agency_id = get_user_agency_id());

CREATE OR REPLACE FUNCTION consume_ai_quota(
  p_agency_id UUID,
  p_event_type TEXT,
  p_units INTEGER DEFAULT 1,
  p_user_id UUID DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_model TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $consume$
DECLARE
  v_month CHAR(7) := to_char(timezone('utc', now()), 'YYYY-MM');
  v_quota INTEGER;
  v_used INTEGER;
BEGIN
  IF p_agency_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'agency_id wajib');
  END IF;

  IF p_units IS NULL OR p_units < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'units tidak valid');
  END IF;

  IF p_event_type NOT IN (
    'cv_screen',
    'interview_summary',
    'async_question_gen',
    'async_analyze'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_type tidak valid');
  END IF;

  SELECT ai_quota_monthly INTO v_quota
  FROM agencies
  WHERE id = p_agency_id
  FOR UPDATE;

  IF v_quota IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Agency tidak ditemukan');
  END IF;

  INSERT INTO agency_usage_monthly (agency_id, year_month)
  VALUES (p_agency_id, v_month)
  ON CONFLICT (agency_id, year_month) DO NOTHING;

  SELECT total_units INTO v_used
  FROM agency_usage_monthly
  WHERE agency_id = p_agency_id AND year_month = v_month
  FOR UPDATE;

  v_used := COALESCE(v_used, 0);

  IF v_used + p_units > v_quota THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Kuota AI bulanan habis',
      'used', v_used,
      'quota', v_quota,
      'remaining', GREATEST(v_quota - v_used, 0),
      'year_month', v_month
    );
  END IF;

  IF p_event_type = 'cv_screen' THEN
    UPDATE agency_usage_monthly
    SET total_units = total_units + p_units,
        cv_screen_count = cv_screen_count + p_units,
        updated_at = now()
    WHERE agency_id = p_agency_id AND year_month = v_month;
  ELSIF p_event_type = 'interview_summary' THEN
    UPDATE agency_usage_monthly
    SET total_units = total_units + p_units,
        interview_summary_count = interview_summary_count + p_units,
        updated_at = now()
    WHERE agency_id = p_agency_id AND year_month = v_month;
  ELSIF p_event_type = 'async_question_gen' THEN
    UPDATE agency_usage_monthly
    SET total_units = total_units + p_units,
        async_question_gen_count = async_question_gen_count + p_units,
        updated_at = now()
    WHERE agency_id = p_agency_id AND year_month = v_month;
  ELSE
    UPDATE agency_usage_monthly
    SET total_units = total_units + p_units,
        async_analyze_count = async_analyze_count + p_units,
        updated_at = now()
    WHERE agency_id = p_agency_id AND year_month = v_month;
  END IF;

  INSERT INTO ai_usage_events (
    agency_id, user_id, event_type, units,
    resource_type, resource_id, model, year_month
  ) VALUES (
    p_agency_id, p_user_id, p_event_type, p_units,
    p_resource_type, p_resource_id, p_model, v_month
  );

  RETURN jsonb_build_object(
    'ok', true,
    'used', v_used + p_units,
    'quota', v_quota,
    'remaining', v_quota - (v_used + p_units),
    'year_month', v_month,
    'event_type', p_event_type,
    'units', p_units
  );
END;
$consume$;

CREATE OR REPLACE FUNCTION consume_ai_quota_for_async_token(
  p_token TEXT,
  p_event_type TEXT,
  p_units INTEGER DEFAULT 1,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_model TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $token$
DECLARE
  v_agency_id UUID;
  v_session_id UUID;
BEGIN
  SELECT agency_id, id INTO v_agency_id, v_session_id
  FROM async_interview_sessions
  WHERE invite_token = p_token
  LIMIT 1;

  IF v_agency_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token interview tidak valid');
  END IF;

  RETURN consume_ai_quota(
    v_agency_id,
    p_event_type,
    p_units,
    NULL,
    COALESCE(p_resource_type, 'async_interview_session'),
    COALESCE(p_resource_id, v_session_id),
    p_model
  );
END;
$token$;

CREATE OR REPLACE FUNCTION get_agency_ai_usage(p_agency_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $usage$
DECLARE
  v_agency_id UUID := COALESCE(p_agency_id, get_user_agency_id());
  v_month CHAR(7) := to_char(timezone('utc', now()), 'YYYY-MM');
  v_quota INTEGER;
  v_plan TEXT;
  v_row agency_usage_monthly%ROWTYPE;
BEGIN
  IF v_agency_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tidak ada agency');
  END IF;

  IF p_agency_id IS NOT NULL
     AND get_user_agency_id() IS NOT NULL
     AND p_agency_id <> get_user_agency_id() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  SELECT ai_quota_monthly, plan_tier INTO v_quota, v_plan
  FROM agencies
  WHERE id = v_agency_id;

  IF v_quota IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Agency tidak ditemukan');
  END IF;

  SELECT * INTO v_row
  FROM agency_usage_monthly
  WHERE agency_id = v_agency_id AND year_month = v_month;

  RETURN jsonb_build_object(
    'ok', true,
    'agency_id', v_agency_id,
    'year_month', v_month,
    'plan_tier', v_plan,
    'quota', v_quota,
    'used', COALESCE(v_row.total_units, 0),
    'remaining', GREATEST(v_quota - COALESCE(v_row.total_units, 0), 0),
    'breakdown', jsonb_build_object(
      'cv_screen', COALESCE(v_row.cv_screen_count, 0),
      'interview_summary', COALESCE(v_row.interview_summary_count, 0),
      'async_question_gen', COALESCE(v_row.async_question_gen_count, 0),
      'async_analyze', COALESCE(v_row.async_analyze_count, 0)
    )
  );
END;
$usage$;

GRANT EXECUTE ON FUNCTION consume_ai_quota(UUID, TEXT, INTEGER, UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_ai_quota_for_async_token(TEXT, TEXT, INTEGER, TEXT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_agency_ai_usage(UUID) TO authenticated;
