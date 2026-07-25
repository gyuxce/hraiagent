-- =============================================================================
-- Video retention — auto-hapus media interview setelah X hari
-- Jalankan SELURUH file ini sekali di Supabase SQL Editor.
-- =============================================================================

-- 0 = matikan auto-hapus; selain itu minimal 7, maksimal 365 hari
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS video_retention_days INTEGER NOT NULL DEFAULT 30
    CHECK (
      video_retention_days = 0
      OR (video_retention_days >= 7 AND video_retention_days <= 365)
    );

COMMENT ON COLUMN agencies.video_retention_days IS
  'Hari penyimpanan video/selfie/face-frame interview. 0 = jangan hapus otomatis. Skor & transkrip tetap disimpan.';

ALTER TABLE async_interview_sessions
  ADD COLUMN IF NOT EXISTS media_purged_at TIMESTAMPTZ;

COMMENT ON COLUMN async_interview_sessions.media_purged_at IS
  'Waktu media (video/selfie/face-frame) dihapus dari storage sesuai kebijakan retensi.';

CREATE INDEX IF NOT EXISTS idx_async_sessions_purge_candidates
  ON async_interview_sessions (agency_id, media_purged_at, completed_at, expires_at, created_at)
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
