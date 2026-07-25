-- =============================================================================
-- Lightweight identity guards for async video interview
-- Run di Supabase SQL Editor setelah 00006+
-- =============================================================================

ALTER TABLE async_interview_sessions
  ADD COLUMN IF NOT EXISTS selfie_path TEXT,
  ADD COLUMN IF NOT EXISTS selfie_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS face_frame_path TEXT,
  ADD COLUMN IF NOT EXISTS challenge_code TEXT,
  ADD COLUMN IF NOT EXISTS challenge_question_id UUID REFERENCES async_interview_questions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS challenge_passed BOOLEAN,
  ADD COLUMN IF NOT EXISTS face_match_status TEXT
    CHECK (
      face_match_status IS NULL
      OR face_match_status IN (
        'pending',
        'match',
        'mismatch',
        'unclear',
        'skipped',
        'manual'
      )
    ),
  ADD COLUMN IF NOT EXISTS face_match_note TEXT,
  ADD COLUMN IF NOT EXISTS needs_manual_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_summary TEXT;

-- Allow selfie / face-frame images in the same bucket
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'video/webm',
  'video/mp4',
  'video/quicktime',
  'audio/webm',
  'audio/mp4',
  'image/jpeg',
  'image/png',
  'image/webp'
]
WHERE id = 'interview-videos';

CREATE OR REPLACE FUNCTION public.save_async_interview_selfie(
  p_token text,
  p_selfie_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess_id uuid;
BEGIN
  IF p_selfie_path IS NULL OR length(trim(p_selfie_path)) = 0 THEN
    RAISE EXCEPTION 'Path selfie kosong';
  END IF;

  UPDATE async_interview_sessions
  SET
    selfie_path = trim(p_selfie_path),
    selfie_captured_at = now(),
    status = CASE WHEN status = 'sent' THEN 'in_progress'::async_interview_status ELSE status END,
    started_at = COALESCE(started_at, now())
  WHERE invite_token = p_token
    AND status IN ('sent', 'in_progress')
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING id INTO sess_id;

  IF sess_id IS NULL THEN
    RAISE EXCEPTION 'Interview tidak valid atau sudah selesai';
  END IF;

  RETURN jsonb_build_object('session_id', sess_id, 'selfie_path', trim(p_selfie_path));
END;
$$;

CREATE OR REPLACE FUNCTION public.save_async_interview_face_frame(
  p_token text,
  p_face_frame_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess_id uuid;
BEGIN
  IF p_face_frame_path IS NULL OR length(trim(p_face_frame_path)) = 0 THEN
    RAISE EXCEPTION 'Path face frame kosong';
  END IF;

  UPDATE async_interview_sessions
  SET face_frame_path = trim(p_face_frame_path)
  WHERE invite_token = p_token
    AND status IN ('sent', 'in_progress')
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING id INTO sess_id;

  IF sess_id IS NULL THEN
    RAISE EXCEPTION 'Interview tidak valid atau sudah selesai';
  END IF;

  RETURN jsonb_build_object('session_id', sess_id, 'face_frame_path', trim(p_face_frame_path));
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_async_interview(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess async_interview_sessions%ROWTYPE;
BEGIN
  SELECT * INTO sess
  FROM async_interview_sessions
  WHERE invite_token = p_token
    AND status IN ('sent', 'in_progress')
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interview tidak valid';
  END IF;

  IF sess.selfie_path IS NULL OR length(trim(sess.selfie_path)) = 0 THEN
    RAISE EXCEPTION 'Selfie wajib sebelum menyelesaikan interview';
  END IF;

  UPDATE async_interview_sessions
  SET status = 'completed', completed_at = now()
  WHERE id = sess.id;

  RETURN sess.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_async_interview_identity(
  p_token text,
  p_challenge_passed boolean DEFAULT NULL,
  p_face_match_status text DEFAULT NULL,
  p_face_match_note text DEFAULT NULL,
  p_needs_manual_review boolean DEFAULT NULL,
  p_identity_summary text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE async_interview_sessions
  SET
    challenge_passed = COALESCE(p_challenge_passed, challenge_passed),
    face_match_status = COALESCE(p_face_match_status, face_match_status),
    face_match_note = COALESCE(p_face_match_note, face_match_note),
    needs_manual_review = COALESCE(p_needs_manual_review, needs_manual_review),
    identity_summary = COALESCE(p_identity_summary, identity_summary)
  WHERE invite_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesi tidak ditemukan';
  END IF;
END;
$$;

-- Allow null overall score + null per-answer scores (weak transcript path)
CREATE OR REPLACE FUNCTION public.save_async_interview_analysis(
  p_token text,
  p_answer_scores jsonb,
  p_overall_score integer,
  p_overall_summary text,
  p_allow_null_overall boolean DEFAULT false
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
          WHEN (item->>'clear_score') = 'true' THEN NULL
          WHEN item ? 'score' AND jsonb_typeof(item->'score') = 'null' THEN NULL
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
      WHEN p_allow_null_overall AND p_overall_score IS NULL THEN NULL
      WHEN p_overall_score IS NULL THEN overall_score
      ELSE LEAST(100, GREATEST(0, p_overall_score))
    END,
    overall_summary = COALESCE(NULLIF(trim(p_overall_summary), ''), overall_summary),
    updated_at = now()
  WHERE id = sess.id;

  RETURN sess.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_async_interview_selfie(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_async_interview_face_frame(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_async_interview_identity(text, boolean, text, text, boolean, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_async_interview_analysis(text, jsonb, integer, text, boolean)
  TO anon, authenticated;
