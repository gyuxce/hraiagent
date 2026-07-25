-- =============================================================================
-- Storage bucket for CV uploads
-- Run in Supabase SQL Editor
-- =============================================================================

-- Create private bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cvs',
  'cvs',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

-- Policies: authenticated users in same agency folder structure
-- Path format: {agency_id}/{job_id}/{filename}

DROP POLICY IF EXISTS "Agency users can upload CVs" ON storage.objects;
DROP POLICY IF EXISTS "Agency users can read CVs" ON storage.objects;
DROP POLICY IF EXISTS "Agency users can update CVs" ON storage.objects;
DROP POLICY IF EXISTS "Agency users can delete CVs" ON storage.objects;

CREATE POLICY "Agency users can upload CVs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = (SELECT agency_id::text FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Agency users can read CVs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = (SELECT agency_id::text FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Agency users can update CVs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = (SELECT agency_id::text FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Agency users can delete CVs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = (SELECT agency_id::text FROM public.users WHERE id = auth.uid())
  );
