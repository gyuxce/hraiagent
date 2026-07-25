-- =============================================================================
-- Phase 3: Interview scheduling (in-app calendar)
-- =============================================================================

CREATE TYPE interview_schedule_status AS ENUM (
  'scheduled',
  'completed',
  'cancelled',
  'no_show'
);

CREATE TABLE IF NOT EXISTS interview_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job_requisitions(id) ON DELETE CASCADE,
  client_id UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  location TEXT,
  meeting_url TEXT,
  notes TEXT,
  status interview_schedule_status NOT NULL DEFAULT 'scheduled',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_schedules_agency ON interview_schedules(agency_id);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_candidate ON interview_schedules(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_client ON interview_schedules(client_id);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_at ON interview_schedules(scheduled_at);

ALTER TABLE interview_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view interview schedules" ON interview_schedules;
DROP POLICY IF EXISTS "Staff can insert interview schedules" ON interview_schedules;
DROP POLICY IF EXISTS "Staff can update interview schedules" ON interview_schedules;
DROP POLICY IF EXISTS "Admin can delete interview schedules" ON interview_schedules;

CREATE POLICY "Users can view interview schedules"
  ON interview_schedules FOR SELECT
  TO authenticated
  USING (
    agency_id = get_user_agency_id()
    AND (
      NOT is_client_viewer()
      OR client_id = get_user_client_id()
    )
  );

CREATE POLICY "Staff can insert interview schedules"
  ON interview_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id = get_user_agency_id()
    AND is_agency_staff()
  );

CREATE POLICY "Staff can update interview schedules"
  ON interview_schedules FOR UPDATE
  TO authenticated
  USING (
    agency_id = get_user_agency_id()
    AND is_agency_staff()
  );

CREATE POLICY "Admin can delete interview schedules"
  ON interview_schedules FOR DELETE
  TO authenticated
  USING (agency_id = get_user_agency_id() AND is_admin_agency());

DROP TRIGGER IF EXISTS set_interview_schedules_updated_at ON interview_schedules;
CREATE TRIGGER set_interview_schedules_updated_at
  BEFORE UPDATE ON interview_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
