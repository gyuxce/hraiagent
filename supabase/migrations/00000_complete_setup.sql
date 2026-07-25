-- =============================================================================
-- RECRUITMENT PLATFORM - COMPLETE DATABASE SETUP
-- Copy-paste this entire file into Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- 1. ENUM TYPES
-- =============================================================================

CREATE TYPE user_role AS ENUM ('admin_agency', 'recruiter', 'client_viewer');
CREATE TYPE job_status AS ENUM ('open', 'closed', 'on_hold');
CREATE TYPE candidate_status AS ENUM ('submitted', 'screened', 'interview', 'offer', 'hired', 'rejected');

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- Agencies: Each recruitment agency is a tenant
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client companies: Companies that are clients of an agency
CREATE TABLE client_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Job requisitions: Job openings posted by agencies for their clients
CREATE TABLE job_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements JSONB DEFAULT '[]'::jsonb,
  status job_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Candidates: People who have applied for jobs
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES job_requisitions(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cv_file_path TEXT,
  parsed_data JSONB,
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
  ai_summary TEXT,
  status candidate_status NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users: Extends Supabase auth.users with profile data
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  role user_role NOT NULL DEFAULT 'recruiter',
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. INDEXES
-- =============================================================================

CREATE INDEX idx_agencies_name ON agencies(name);
CREATE INDEX idx_client_companies_agency_id ON client_companies(agency_id);
CREATE INDEX idx_client_companies_name ON client_companies(name);
CREATE INDEX idx_job_requisitions_agency_id ON job_requisitions(agency_id);
CREATE INDEX idx_job_requisitions_client_id ON job_requisitions(client_id);
CREATE INDEX idx_job_requisitions_status ON job_requisitions(status);
CREATE INDEX idx_candidates_agency_id ON candidates(agency_id);
CREATE INDEX idx_candidates_job_id ON candidates(job_id);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_ai_score ON candidates(ai_score DESC);
CREATE INDEX idx_users_agency_id ON users(agency_id);
CREATE INDEX idx_users_role ON users(role);

-- =============================================================================
-- 4. HELPER FUNCTIONS
-- =============================================================================

-- Get current user's agency_id
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID AS $$
  SELECT agency_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is admin_agency
CREATE OR REPLACE FUNCTION is_admin_agency()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin_agency'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Handle new user signup - creates profile in users table
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'recruiter'::user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. TRIGGERS
-- =============================================================================

-- Auto-update updated_at on all tables
CREATE TRIGGER set_agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_client_companies_updated_at
  BEFORE UPDATE ON client_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_job_requisitions_updated_at
  BEFORE UPDATE ON job_requisitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 7. RLS POLICIES
-- =============================================================================

-- AGENCIES
CREATE POLICY "Users can view own agency"
  ON agencies FOR SELECT
  USING (id = get_user_agency_id());

CREATE POLICY "Admin can update own agency"
  ON agencies FOR UPDATE
  USING (id = get_user_agency_id() AND is_admin_agency());

CREATE POLICY "Admin can insert agency"
  ON agencies FOR INSERT
  WITH CHECK (true);

-- CLIENT_COMPANIES
CREATE POLICY "Users can view own agency clients"
  ON client_companies FOR SELECT
  USING (agency_id = get_user_agency_id());

CREATE POLICY "Admin and recruiter can insert clients"
  ON client_companies FOR INSERT
  WITH CHECK (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Admin and recruiter can update clients"
  ON client_companies FOR UPDATE
  USING (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Admin can delete clients"
  ON client_companies FOR DELETE
  USING (agency_id = get_user_agency_id() AND is_admin_agency());

-- JOB_REQUISITIONS
CREATE POLICY "Users can view own agency jobs"
  ON job_requisitions FOR SELECT
  USING (agency_id = get_user_agency_id());

CREATE POLICY "Admin and recruiter can insert jobs"
  ON job_requisitions FOR INSERT
  WITH CHECK (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Admin and recruiter can update jobs"
  ON job_requisitions FOR UPDATE
  USING (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Admin can delete jobs"
  ON job_requisitions FOR DELETE
  USING (agency_id = get_user_agency_id() AND is_admin_agency());

-- CANDIDATES
CREATE POLICY "Users can view own agency candidates"
  ON candidates FOR SELECT
  USING (agency_id = get_user_agency_id());

CREATE POLICY "Admin and recruiter can insert candidates"
  ON candidates FOR INSERT
  WITH CHECK (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Admin and recruiter can update candidates"
  ON candidates FOR UPDATE
  USING (
    agency_id = get_user_agency_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_agency', 'recruiter')
    )
  );

CREATE POLICY "Admin can delete candidates"
  ON candidates FOR DELETE
  USING (agency_id = get_user_agency_id() AND is_admin_agency());

-- USERS
CREATE POLICY "Users can view own agency users"
  ON users FOR SELECT
  USING (agency_id = get_user_agency_id());

CREATE POLICY "Admin can insert users to own agency"
  ON users FOR INSERT
  WITH CHECK (
    agency_id = get_user_agency_id()
    AND is_admin_agency()
  );

CREATE POLICY "Admin can update users in own agency"
  ON users FOR UPDATE
  USING (
    agency_id = get_user_agency_id()
    AND is_admin_agency()
  );

CREATE POLICY "Admin can delete users from own agency"
  ON users FOR DELETE
  USING (
    agency_id = get_user_agency_id()
    AND is_admin_agency()
  );
