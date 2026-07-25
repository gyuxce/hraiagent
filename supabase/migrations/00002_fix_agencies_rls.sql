-- =============================================================================
-- FIX: RLS blocking agency create during signup
-- Run this in Supabase SQL Editor
-- =============================================================================

-- 1. Agency policies
DROP POLICY IF EXISTS "Admin can insert agency" ON agencies;
DROP POLICY IF EXISTS "Authenticated users can create agency" ON agencies;
DROP POLICY IF EXISTS "Users can view own agency" ON agencies;
DROP POLICY IF EXISTS "Admin can update own agency" ON agencies;

CREATE POLICY "Users can view own agency"
  ON agencies FOR SELECT
  TO authenticated
  USING (id = get_user_agency_id());

CREATE POLICY "Admin can update own agency"
  ON agencies FOR UPDATE
  TO authenticated
  USING (id = get_user_agency_id() AND is_admin_agency());

-- 2. User can update own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3. Secure RPC for signup: create agency + set user as admin
--    Runs as SECURITY DEFINER so it bypasses RLS safely
CREATE OR REPLACE FUNCTION public.create_agency_with_admin(
  agency_name text,
  admin_full_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_agency_id uuid;
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF agency_name IS NULL OR length(trim(agency_name)) = 0 THEN
    RAISE EXCEPTION 'Agency name is required';
  END IF;

  -- Prevent user from creating multiple agencies
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = current_user_id AND agency_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'User already belongs to an agency';
  END IF;

  INSERT INTO public.agencies (name)
  VALUES (trim(agency_name))
  RETURNING id INTO new_agency_id;

  UPDATE public.users
  SET
    agency_id = new_agency_id,
    role = 'admin_agency',
    full_name = COALESCE(NULLIF(trim(admin_full_name), ''), full_name)
  WHERE id = current_user_id;

  RETURN new_agency_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_agency_with_admin(text, text) TO authenticated;
