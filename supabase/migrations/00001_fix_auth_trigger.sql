-- =============================================================================
-- FIX: Database error saving new user
-- Run this in Supabase SQL Editor
-- =============================================================================

-- 1. Drop broken policies that block signup
DROP POLICY IF EXISTS "Users can view own agency users" ON users;
DROP POLICY IF EXISTS "Admin can insert users to own agency" ON users;
DROP POLICY IF EXISTS "Admin can update users in own agency" ON users;
DROP POLICY IF EXISTS "Admin can delete users from own agency" ON users;

-- 2. Fix handle_new_user trigger (bypass RLS properly)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User'),
    'recruiter'::user_role
  );
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Grant permissions so auth can write profile
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

-- 4. New RLS policies that allow signup + multi-tenant isolation
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can view same agency users"
  ON users FOR SELECT
  USING (
    agency_id IS NOT NULL
    AND agency_id = get_user_agency_id()
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admin can insert users to own agency"
  ON users FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR (
      agency_id = get_user_agency_id()
      AND is_admin_agency()
    )
  );

CREATE POLICY "Admin can delete users from own agency"
  ON users FOR DELETE
  USING (
    agency_id = get_user_agency_id()
    AND is_admin_agency()
    AND id <> auth.uid()
  );

-- 5. Fix agencies policies for signup flow
DROP POLICY IF EXISTS "Admin can insert agency" ON agencies;
DROP POLICY IF EXISTS "Users can view own agency" ON agencies;
DROP POLICY IF EXISTS "Admin can update own agency" ON agencies;

CREATE POLICY "Authenticated users can create agency"
  ON agencies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view own agency"
  ON agencies FOR SELECT
  TO authenticated
  USING (id = get_user_agency_id());

CREATE POLICY "Admin can update own agency"
  ON agencies FOR UPDATE
  TO authenticated
  USING (id = get_user_agency_id() AND is_admin_agency());

-- 6. Ensure helper functions are safe
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT agency_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_admin_agency()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin_agency'
  );
$$;
