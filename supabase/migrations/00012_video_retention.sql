-- =============================================================================
-- Video retention — auto-hapus media interview setelah X hari
-- Jalankan SELURUH file ini sekali di Supabase SQL Editor (Run, bukan partial).
--
-- Prasyarat: tabel public.agencies & public.async_interview_sessions sudah ada
-- (dari 00000 + 00006). Cek dulu bila ragu:
--   SELECT to_regclass('public.agencies'),
--          to_regclass('public.async_interview_sessions');
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NULL THEN
    RAISE EXCEPTION
      'Tabel public.agencies tidak ditemukan. Pastikan project Supabase benar dan sudah menjalankan 00000_complete_setup.sql.';
  END IF;
  IF to_regclass('public.async_interview_sessions') IS NULL THEN
    RAISE EXCEPTION
      'Tabel public.async_interview_sessions tidak ditemukan. Jalankan 00006_async_interview.sql dulu.';
  END IF;
END $$;

-- 0 = matikan auto-hapus; selain itu minimal 7, maksimal 365 hari
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS video_retention_days INTEGER NOT NULL DEFAULT 30;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agencies_video_retention_days_check'
      AND conrelid = 'public.agencies'::regclass
  ) THEN
    ALTER TABLE public.agencies
      ADD CONSTRAINT agencies_video_retention_days_check
      CHECK (
        video_retention_days = 0
        OR (video_retention_days >= 7 AND video_retention_days <= 365)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.agencies.video_retention_days IS
  'Hari penyimpanan video/selfie/face-frame interview. 0 = jangan hapus otomatis. Skor & transkrip tetap disimpan.';

ALTER TABLE public.async_interview_sessions
  ADD COLUMN IF NOT EXISTS media_purged_at TIMESTAMPTZ;

COMMENT ON COLUMN public.async_interview_sessions.media_purged_at IS
  'Waktu media (video/selfie/face-frame) dihapus dari storage sesuai kebijakan retensi.';

CREATE INDEX IF NOT EXISTS idx_async_sessions_purge_candidates
  ON public.async_interview_sessions (
    agency_id, media_purged_at, completed_at, expires_at, created_at
  )
  WHERE media_purged_at IS NULL;

-- Allow agency staff to delete objects under their agency folder (cron uses service role).
DROP POLICY IF EXISTS "Agency can delete interview videos" ON storage.objects;
CREATE POLICY "Agency can delete interview videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'interview-videos'
    AND (storage.foldername(name))[1] = (
      SELECT agency_id::text FROM public.users WHERE id = auth.uid()
    )
  );
