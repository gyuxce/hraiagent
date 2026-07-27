-- 00013: Persetujuan (consent) eksplisit kandidat untuk rekaman video/audio interview
-- Kepatuhan UU PDP No. 27/2022 — bukti consent tersimpan per sesi.

ALTER TABLE async_interview_sessions
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_version TEXT;

CREATE OR REPLACE FUNCTION public.save_async_interview_consent(
  p_token text,
  p_version text DEFAULT 'v1'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess_id uuid;
BEGIN
  UPDATE async_interview_sessions
  SET
    consent_at = COALESCE(consent_at, now()),
    consent_version = COALESCE(consent_version, left(trim(p_version), 40))
  WHERE invite_token = p_token
    AND status IN ('sent', 'in_progress')
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING id INTO sess_id;

  IF sess_id IS NULL THEN
    RAISE EXCEPTION 'Sesi interview tidak valid atau sudah selesai/kadaluarsa';
  END IF;

  RETURN jsonb_build_object('ok', true, 'session_id', sess_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_async_interview_consent(text, text) TO anon, authenticated;
