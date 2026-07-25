-- =============================================================================
-- Phase 1 gap: Team invites + client_viewer scoping + async auto-analyze RPC
-- Run di Supabase SQL Editor after 00000–00006
-- =============================================================================

-- 1) Scope client_viewer ke satu client company
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES client_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);

-- 2) Team invites
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'recruiter',
  client_id UUID REFERENCES client_companies(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_invites_client_viewer_requires_client CHECK (
    role <> 'client_viewer' OR client_id IS NOT NULL
  ),
  CONSTRAINT team_invites_staff_no_client CHECK (
    role = 'client_viewer' OR client_id IS NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_team_invites_agency ON team_invites(agency_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view team invites" ON team_invites;
DROP POLICY IF EXISTS "Admin can insert team invites" ON team_invites;
DROP POLICY IF EXISTS "Admin can update team invites" ON team_invites;
DROP POLICY IF EXISTS "Admin can delete team invites" ON team_invites;

CREATE POLICY "Admin can view team invites"
  ON team_invites FOR SELECT
  TO authenticated
  USING (agency_id = get_user_agency_id() AND is_admin_agency());

CREATE POLICY "Admin can insert team invites"
  ON team_invites FOR INSERT
  TO authenticated
  WITH CHECK (agency_id = get_user_agency_id() AND is_admin_agency());

CREATE POLICY "Admin can update team invites"
  ON team_invites FOR UPDATE
  TO authenticated
  USING (agency_id = get_user_agency_id() AND is_admin_agency());

CREATE POLICY "Admin can delete team invites"
  ON team_invites FOR DELETE
  TO authenticated
  USING (agency_id = get_user_agency_id() AND is_admin_agency());

-- 3) Helper functions for role/client scope
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID AS $$
  SELECT client_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_client_viewer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'client_viewer'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_agency_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 4) Tighten SELECT policies for client_viewer
DROP POLICY IF EXISTS "Users can view own agency clients" ON client_companies;
CREATE POLICY "Users can view own agency clients"
  ON client_companies FOR SELECT
  TO authenticated
  USING (
    agency_id = get_user_agency_id()
    AND (
      NOT is_client_viewer()
      OR id = get_user_client_id()
    )
  );

DROP POLICY IF EXISTS "Users can view own agency jobs" ON job_requisitions;
CREATE POLICY "Users can view own agency jobs"
  ON job_requisitions FOR SELECT
  TO authenticated
  USING (
    agency_id = get_user_agency_id()
    AND (
      NOT is_client_viewer()
      OR client_id = get_user_client_id()
    )
  );

DROP POLICY IF EXISTS "Users can view own agency candidates" ON candidates;
CREATE POLICY "Users can view own agency candidates"
  ON candidates FOR SELECT
  TO authenticated
  USING (
    agency_id = get_user_agency_id()
    AND (
      NOT is_client_viewer()
      OR job_id IN (
        SELECT id FROM job_requisitions WHERE client_id = get_user_client_id()
      )
    )
  );

DROP POLICY IF EXISTS "Users can view own agency interview notes" ON interview_notes;
CREATE POLICY "Users can view own agency interview notes"
  ON interview_notes FOR SELECT
  TO authenticated
  USING (
    agency_id = get_user_agency_id()
    AND (
      NOT is_client_viewer()
      OR candidate_id IN (
        SELECT c.id
        FROM candidates c
        JOIN job_requisitions j ON j.id = c.job_id
        WHERE j.client_id = get_user_client_id()
      )
    )
  );

DROP POLICY IF EXISTS "Agency can view async sessions" ON async_interview_sessions;
CREATE POLICY "Agency can view async sessions"
  ON async_interview_sessions FOR SELECT
  TO authenticated
  USING (
    agency_id = get_user_agency_id()
    AND (
      NOT is_client_viewer()
      OR job_id IN (
        SELECT id FROM job_requisitions WHERE client_id = get_user_client_id()
      )
    )
  );

DROP POLICY IF EXISTS "Agency can view async questions" ON async_interview_questions;
CREATE POLICY "Agency can view async questions"
  ON async_interview_questions FOR SELECT
  TO authenticated
  USING (
    agency_id = get_user_agency_id()
    AND (
      NOT is_client_viewer()
      OR session_id IN (
        SELECT s.id
        FROM async_interview_sessions s
        JOIN job_requisitions j ON j.id = s.job_id
        WHERE j.client_id = get_user_client_id()
      )
    )
  );

DROP POLICY IF EXISTS "Agency can view async answers" ON async_interview_answers;
CREATE POLICY "Agency can view async answers"
  ON async_interview_answers FOR SELECT
  TO authenticated
  USING (
    agency_id = get_user_agency_id()
    AND (
      NOT is_client_viewer()
      OR session_id IN (
        SELECT s.id
        FROM async_interview_sessions s
        JOIN job_requisitions j ON j.id = s.job_id
        WHERE j.client_id = get_user_client_id()
      )
    )
  );

-- 5) Public invite lookup + accept
CREATE OR REPLACE FUNCTION public.get_team_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', i.id,
    'email', i.email,
    'role', i.role,
    'client_id', i.client_id,
    'client_name', cc.name,
    'agency_id', i.agency_id,
    'agency_name', a.name,
    'expires_at', i.expires_at,
    'accepted_at', i.accepted_at
  )
  INTO result
  FROM team_invites i
  JOIN agencies a ON a.id = i.agency_id
  LEFT JOIN client_companies cc ON cc.id = i.client_id
  WHERE i.token = p_token
    AND i.accepted_at IS NULL
    AND i.expires_at > now();

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_team_invite(
  p_token text,
  p_full_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv team_invites%ROWTYPE;
  current_user_id uuid := auth.uid();
  user_email text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO inv
  FROM team_invites
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite tidak valid atau sudah kadaluarsa';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;
  IF user_email IS NULL OR lower(user_email) <> lower(inv.email) THEN
    RAISE EXCEPTION 'Email akun harus sama dengan email undangan (%)', inv.email;
  END IF;

  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = current_user_id
      AND agency_id IS NOT NULL
      AND agency_id <> inv.agency_id
  ) THEN
    RAISE EXCEPTION 'Akun sudah terhubung ke agency lain';
  END IF;

  UPDATE users
  SET
    agency_id = inv.agency_id,
    role = inv.role,
    client_id = inv.client_id,
    full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name)
  WHERE id = current_user_id;

  UPDATE team_invites
  SET accepted_at = now()
  WHERE id = inv.id;

  RETURN inv.agency_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_invite_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text, text) TO authenticated;

-- 6) Save async interview AI scores via invite token (auto-analyze after public submit)
CREATE OR REPLACE FUNCTION public.save_async_interview_analysis(
  p_token text,
  p_answer_scores jsonb,
  p_overall_score integer,
  p_overall_summary text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess async_interview_sessions%ROWTYPE;
  item jsonb;
  ans_id uuid;
BEGIN
  SELECT * INTO sess
  FROM async_interview_sessions
  WHERE invite_token = p_token
    AND status = 'completed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesi interview tidak ditemukan / belum selesai';
  END IF;

  IF p_answer_scores IS NOT NULL AND jsonb_typeof(p_answer_scores) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(p_answer_scores)
    LOOP
      ans_id := NULLIF(item->>'answer_id', '')::uuid;
      IF ans_id IS NULL THEN
        CONTINUE;
      END IF;

      UPDATE async_interview_answers a
      SET
        ai_score = CASE
          WHEN item ? 'score' AND item->>'score' ~ '^[0-9]+$'
            THEN LEAST(100, GREATEST(0, (item->>'score')::int))
          ELSE a.ai_score
        END,
        ai_feedback = COALESCE(NULLIF(item->>'feedback', ''), a.ai_feedback),
        updated_at = now()
      WHERE a.id = ans_id
        AND a.session_id = sess.id;
    END LOOP;
  END IF;

  UPDATE async_interview_sessions
  SET
    overall_score = CASE
      WHEN p_overall_score IS NULL THEN overall_score
      ELSE LEAST(100, GREATEST(0, p_overall_score))
    END,
    overall_summary = COALESCE(NULLIF(trim(p_overall_summary), ''), overall_summary),
    updated_at = now()
  WHERE id = sess.id;

  RETURN sess.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_async_interview_analysis(text, jsonb, integer, text)
  TO anon, authenticated;
