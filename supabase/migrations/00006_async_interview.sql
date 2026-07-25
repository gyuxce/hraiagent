-- =============================================================================
-- Phase 2.5: Async AI Interview
-- Run di Supabase SQL Editor
-- =============================================================================

CREATE TYPE async_interview_status AS ENUM (
  'draft',
  'sent',
  'in_progress',
  'completed',
  'expired'
);

CREATE TABLE IF NOT EXISTS async_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job_requisitions(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status async_interview_status NOT NULL DEFAULT 'draft',
  overall_score INTEGER CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),
  overall_summary TEXT,
  expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS async_interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES async_interview_sessions(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  focus_area TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS async_interview_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES async_interview_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES async_interview_questions(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  text_answer TEXT,
  video_path TEXT,
  transcript TEXT,
  ai_score INTEGER CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  ai_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id)
);

CREATE INDEX IF NOT EXISTS idx_async_sessions_agency ON async_interview_sessions(agency_id);
CREATE INDEX IF NOT EXISTS idx_async_sessions_candidate ON async_interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_async_sessions_job ON async_interview_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_async_sessions_token ON async_interview_sessions(invite_token);
CREATE INDEX IF NOT EXISTS idx_async_questions_session ON async_interview_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_async_answers_session ON async_interview_answers(session_id);

ALTER TABLE async_interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE async_interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE async_interview_answers ENABLE ROW LEVEL SECURITY;

-- Agency staff policies
CREATE POLICY "Agency can view async sessions"
  ON async_interview_sessions FOR SELECT
  USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency recruiter can insert async sessions"
  ON async_interview_sessions FOR INSERT
  WITH CHECK (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Agency recruiter can update async sessions"
  ON async_interview_sessions FOR UPDATE
  USING (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Admin can delete async sessions"
  ON async_interview_sessions FOR DELETE
  USING (agency_id = get_user_agency_id() AND is_admin_agency());

CREATE POLICY "Agency can view async questions"
  ON async_interview_questions FOR SELECT
  USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency recruiter can insert async questions"
  ON async_interview_questions FOR INSERT
  WITH CHECK (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Agency recruiter can update async questions"
  ON async_interview_questions FOR UPDATE
  USING (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Admin can delete async questions"
  ON async_interview_questions FOR DELETE
  USING (agency_id = get_user_agency_id() AND is_admin_agency());

CREATE POLICY "Agency can view async answers"
  ON async_interview_answers FOR SELECT
  USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency recruiter can manage async answers"
  ON async_interview_answers FOR ALL
  USING (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

-- Public access helper via SECURITY DEFINER functions (token-based)
CREATE OR REPLACE FUNCTION public.get_async_interview_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'session', to_jsonb(s),
    'candidate', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'email', c.email
    ),
    'job', jsonb_build_object(
      'id', j.id,
      'title', j.title,
      'description', j.description
    ),
    'questions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'question_text', q.question_text,
          'focus_area', q.focus_area,
          'sort_order', q.sort_order,
          'answer', (
            SELECT jsonb_build_object(
              'id', a.id,
              'text_answer', a.text_answer,
              'video_path', a.video_path,
              'transcript', a.transcript
            )
            FROM async_interview_answers a
            WHERE a.question_id = q.id
            LIMIT 1
          )
        )
        ORDER BY q.sort_order
      )
      FROM async_interview_questions q
      WHERE q.session_id = s.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM async_interview_sessions s
  JOIN candidates c ON c.id = s.candidate_id
  JOIN job_requisitions j ON j.id = s.job_id
  WHERE s.invite_token = p_token
    AND s.status IN ('sent', 'in_progress', 'completed')
    AND (s.expires_at IS NULL OR s.expires_at > now());

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_async_interview_answer(
  p_token text,
  p_question_id uuid,
  p_text_answer text DEFAULT NULL,
  p_transcript text DEFAULT NULL,
  p_video_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess async_interview_sessions%ROWTYPE;
  ans_id uuid;
BEGIN
  SELECT * INTO sess
  FROM async_interview_sessions
  WHERE invite_token = p_token
    AND status IN ('sent', 'in_progress')
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interview tidak valid atau sudah selesai';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM async_interview_questions
    WHERE id = p_question_id AND session_id = sess.id
  ) THEN
    RAISE EXCEPTION 'Pertanyaan tidak valid';
  END IF;

  IF sess.status = 'sent' THEN
    UPDATE async_interview_sessions
    SET status = 'in_progress', started_at = COALESCE(started_at, now())
    WHERE id = sess.id;
  END IF;

  INSERT INTO async_interview_answers (
    session_id, question_id, agency_id, text_answer, transcript, video_path
  )
  VALUES (
    sess.id,
    p_question_id,
    sess.agency_id,
    NULLIF(trim(COALESCE(p_text_answer, '')), ''),
    NULLIF(trim(COALESCE(p_transcript, '')), ''),
    NULLIF(trim(COALESCE(p_video_path, '')), '')
  )
  ON CONFLICT (question_id) DO UPDATE SET
    text_answer = COALESCE(EXCLUDED.text_answer, async_interview_answers.text_answer),
    transcript = COALESCE(EXCLUDED.transcript, async_interview_answers.transcript),
    video_path = COALESCE(EXCLUDED.video_path, async_interview_answers.video_path),
    updated_at = now()
  RETURNING id INTO ans_id;

  RETURN jsonb_build_object('answer_id', ans_id, 'session_id', sess.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_async_interview(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess_id uuid;
BEGIN
  UPDATE async_interview_sessions
  SET status = 'completed', completed_at = now()
  WHERE invite_token = p_token
    AND status IN ('sent', 'in_progress')
  RETURNING id INTO sess_id;

  IF sess_id IS NULL THEN
    RAISE EXCEPTION 'Interview tidak valid';
  END IF;

  RETURN sess_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_async_interview_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_async_interview_answer(text, uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_async_interview(text) TO anon, authenticated;

-- Storage bucket for interview videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'interview-videos',
  'interview-videos',
  false,
  52428800,
  ARRAY['video/webm', 'video/mp4', 'video/quicktime', 'audio/webm', 'audio/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['video/webm', 'video/mp4', 'video/quicktime', 'audio/webm', 'audio/mp4'];

DROP POLICY IF EXISTS "Agency can read interview videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone with path can upload interview videos" ON storage.objects;

CREATE POLICY "Agency can read interview videos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'interview-videos'
    AND (storage.foldername(name))[1] = (SELECT agency_id::text FROM public.users WHERE id = auth.uid())
  );

-- Allow public upload to interview-videos only under invite tokens is hard with RLS;
-- Upload via service path through authenticated recruiter or open upload with token folder.
-- For candidate upload we use a more open insert policy constrained by bucket.
CREATE POLICY "Public can upload interview videos"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'interview-videos');

CREATE POLICY "Public can update own interview video objects"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'interview-videos');

DROP TRIGGER IF EXISTS set_async_sessions_updated_at ON async_interview_sessions;
CREATE TRIGGER set_async_sessions_updated_at
  BEFORE UPDATE ON async_interview_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_async_answers_updated_at ON async_interview_answers;
CREATE TRIGGER set_async_answers_updated_at
  BEFORE UPDATE ON async_interview_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
