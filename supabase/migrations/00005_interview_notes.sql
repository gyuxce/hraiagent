-- =============================================================================
-- Phase 2: Interview Notes (transkrip + AI summary)
-- Run di Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS interview_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Interview Notes',
  transcript TEXT NOT NULL,
  ai_summary TEXT,
  interviewer_notes TEXT,
  conducted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_notes_agency_id ON interview_notes(agency_id);
CREATE INDEX IF NOT EXISTS idx_interview_notes_candidate_id ON interview_notes(candidate_id);

ALTER TABLE interview_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agency interview notes" ON interview_notes;
DROP POLICY IF EXISTS "Admin and recruiter can insert interview notes" ON interview_notes;
DROP POLICY IF EXISTS "Admin and recruiter can update interview notes" ON interview_notes;
DROP POLICY IF EXISTS "Admin can delete interview notes" ON interview_notes;

CREATE POLICY "Users can view own agency interview notes"
  ON interview_notes FOR SELECT
  USING (agency_id = get_user_agency_id());

CREATE POLICY "Admin and recruiter can insert interview notes"
  ON interview_notes FOR INSERT
  WITH CHECK (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Admin and recruiter can update interview notes"
  ON interview_notes FOR UPDATE
  USING (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Admin can delete interview notes"
  ON interview_notes FOR DELETE
  USING (agency_id = get_user_agency_id() AND is_admin_agency());

DROP TRIGGER IF EXISTS set_interview_notes_updated_at ON interview_notes;
CREATE TRIGGER set_interview_notes_updated_at
  BEFORE UPDATE ON interview_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
