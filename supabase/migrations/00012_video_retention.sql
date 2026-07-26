-- =============================================================================
-- Video retention — auto-hapus media interview setelah X hari
-- Jalankan SELURUH file ini sekali di Supabase SQL Editor.
--
-- Versi aman: bagian yang tabelnya belum ada akan di-SKIP (bukan gagal total).
-- Setelah run, lihat hasil NOTICE / tabel hasil di bawah.
-- =============================================================================

-- 0) Diagnostik cepat (hasil muncul di Messages / Results)
SELECT
  to_regclass('public.agencies') AS agencies_table,
  to_regclass('public.async_interview_sessions') AS async_sessions_table,
  to_regclass('public.users') AS users_table,
  current_database() AS db_name,
  current_user AS db_user;

DO $$
DECLARE
  v_agencies_ok BOOLEAN := to_regclass('public.agencies') IS NOT NULL;
  v_sessions_ok BOOLEAN := to_regclass('public.async_interview_sessions') IS NOT NULL;
  v_users_ok BOOLEAN := to_regclass('public.users') IS NOT NULL;
BEGIN
  -- 1) agencies.video_retention_days
  IF v_agencies_ok THEN
    ALTER TABLE public.agencies
      ADD COLUMN IF NOT EXISTS video_retention_days INTEGER NOT NULL DEFAULT 30;

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

    COMMENT ON COLUMN public.agencies.video_retention_days IS
      'Hari penyimpanan video/selfie/face-frame interview. 0 = jangan hapus otomatis.';

    RAISE NOTICE 'OK: public.agencies.video_retention_days siap';
  ELSE
    RAISE NOTICE
      'SKIP agencies: tabel public.agencies tidak ada di database ini. Cek project Supabase (URL di Vercel NEXT_PUBLIC_SUPABASE_URL) — kemungkinan SQL Editor beda project. Daftar tabel mirip: lihat query di bawah file ini.';
  END IF;

  -- 2) async_interview_sessions.media_purged_at
  IF v_sessions_ok THEN
    ALTER TABLE public.async_interview_sessions
      ADD COLUMN IF NOT EXISTS media_purged_at TIMESTAMPTZ;

    COMMENT ON COLUMN public.async_interview_sessions.media_purged_at IS
      'Waktu media (video/selfie/face-frame) dihapus dari storage sesuai kebijakan retensi.';

    CREATE INDEX IF NOT EXISTS idx_async_sessions_purge_candidates
      ON public.async_interview_sessions (
        agency_id, media_purged_at, completed_at, expires_at, created_at
      )
      WHERE media_purged_at IS NULL;

    RAISE NOTICE 'OK: public.async_interview_sessions.media_purged_at siap';
  ELSE
    RAISE NOTICE
      'SKIP sessions: public.async_interview_sessions belum ada. Jalankan 00006_async_interview.sql dulu.';
  END IF;

  -- 3) Storage DELETE policy (butuh public.users untuk match agency folder)
  IF v_users_ok THEN
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
    RAISE NOTICE 'OK: storage policy delete interview-videos siap';
  ELSE
    RAISE NOTICE
      'SKIP storage policy: public.users tidak ada. Cron tetap bisa hapus via SUPABASE_SERVICE_ROLE_KEY.';
  END IF;

  IF NOT v_agencies_ok AND NOT v_sessions_ok THEN
    RAISE EXCEPTION
      'Tidak ada public.agencies maupun public.async_interview_sessions. Anda hampir pasti menjalankan SQL di project Supabase yang SALAH (beda dari yang dipakai Vercel). Samakan project ref di Settings → API dengan NEXT_PUBLIC_SUPABASE_URL.';
  END IF;
END $$;

-- Daftar tabel yang mirip "agency" / "interview" (bantu debug project salah)
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND (
    table_name ILIKE '%agenc%'
    OR table_name ILIKE '%interview%'
    OR table_name ILIKE '%user%'
  )
ORDER BY table_schema, table_name;
