-- Paste di Supabase SQL Editor untuk cek apakah project yang benar.
-- Bandingkan hasilnya dengan URL project di Vercel env NEXT_PUBLIC_SUPABASE_URL.

SELECT
  current_database() AS database,
  current_user AS role,
  to_regclass('public.agencies') AS agencies,
  to_regclass('public.users') AS users,
  to_regclass('public.candidates') AS candidates,
  to_regclass('public.async_interview_sessions') AS async_sessions;

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
