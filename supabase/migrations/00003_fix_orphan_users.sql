-- =============================================================================
-- OPTIONAL: Fix users who registered but have no agency_id
-- Run in Supabase SQL Editor if needed
-- =============================================================================

-- Check orphan users
-- SELECT id, full_name, agency_id, role FROM users WHERE agency_id IS NULL;

-- Manual fix example (replace values):
-- INSERT INTO agencies (name) VALUES ('PT Inovasi Langkah Usaha') RETURNING id;
-- UPDATE users SET agency_id = '<agency-id>', role = 'admin_agency' WHERE id = '<user-id>';
