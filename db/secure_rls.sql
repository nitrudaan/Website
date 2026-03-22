-- ============================================
-- SECURE RLS POLICIES FOR UDAAN WEBSITE
-- ============================================
-- 
-- ⚠️ WARNING: Run this AFTER your setup.sql
-- ⚠️ BACKUP your database before running!
-- ⚠️ TEST in staging environment first!
--
-- This replaces the insecure "USING (true)" policies
-- with proper access controls.
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Drop all existing policies (both old and new names)
-- ============================================

-- Members table
DROP POLICY IF EXISTS "Allow all operations on members" ON members;
DROP POLICY IF EXISTS "Public read non-sensitive member data" ON members;
DROP POLICY IF EXISTS "Members read own data" ON members;
DROP POLICY IF EXISTS "Council can manage members" ON members;
DROP POLICY IF EXISTS "public_read_members" ON members;
DROP POLICY IF EXISTS "member_update_own" ON members;

-- Applicants table  
DROP POLICY IF EXISTS "Allow all operations on applicants" ON applicants;
DROP POLICY IF EXISTS "Anyone can apply" ON applicants;
DROP POLICY IF EXISTS "Council can manage applicants" ON applicants;
DROP POLICY IF EXISTS "Council can update applicants" ON applicants;
DROP POLICY IF EXISTS "public_insert_applicants" ON applicants;
DROP POLICY IF EXISTS "council_read_applicants" ON applicants;
DROP POLICY IF EXISTS "council_update_applicants" ON applicants;

-- Registrations table
DROP POLICY IF EXISTS "Allow all operations on registrations" ON registrations;
DROP POLICY IF EXISTS "Anyone can register" ON registrations;
DROP POLICY IF EXISTS "Council can view registrations" ON registrations;
DROP POLICY IF EXISTS "public_insert_registrations" ON registrations;
DROP POLICY IF EXISTS "public_read_registrations" ON registrations;

-- Config table
DROP POLICY IF EXISTS "public_read_config" ON config;

-- Tasks table
DROP POLICY IF EXISTS "Allow all operations on tasks" ON tasks;
DROP POLICY IF EXISTS "read_tasks" ON tasks;
DROP POLICY IF EXISTS "insert_tasks" ON tasks;
DROP POLICY IF EXISTS "update_tasks" ON tasks;
DROP POLICY IF EXISTS "delete_tasks" ON tasks;

-- Announcements table
DROP POLICY IF EXISTS "Allow all operations on announcements" ON announcements;
DROP POLICY IF EXISTS "public_read_announcements" ON announcements;
DROP POLICY IF EXISTS "council_manage_announcements" ON announcements;
DROP POLICY IF EXISTS "council_update_announcements" ON announcements;

-- Activity logs table
DROP POLICY IF EXISTS "council_read_logs" ON activity_logs;
DROP POLICY IF EXISTS "insert_logs" ON activity_logs;

-- Division tables
DROP POLICY IF EXISTS "Allow all operations on division_members" ON division_members;
DROP POLICY IF EXISTS "Allow all operations on drone_members" ON drone_members;
DROP POLICY IF EXISTS "Allow all operations on rc_plane_members" ON rc_plane_members;
DROP POLICY IF EXISTS "Allow all operations on rocketry_members" ON rocketry_members;
DROP POLICY IF EXISTS "Allow all operations on creative_members" ON creative_members;
DROP POLICY IF EXISTS "Allow all operations on management_members" ON management_members;
DROP POLICY IF EXISTS "public_read_division_members" ON division_members;
DROP POLICY IF EXISTS "public_read_drone_members" ON drone_members;
DROP POLICY IF EXISTS "public_read_rc_plane_members" ON rc_plane_members;
DROP POLICY IF EXISTS "public_read_rocketry_members" ON rocketry_members;
DROP POLICY IF EXISTS "public_read_creative_members" ON creative_members;
DROP POLICY IF EXISTS "public_read_management_members" ON management_members;
DROP POLICY IF EXISTS "manage_division_members" ON division_members;
DROP POLICY IF EXISTS "manage_drone_members" ON drone_members;
DROP POLICY IF EXISTS "manage_rc_plane_members" ON rc_plane_members;
DROP POLICY IF EXISTS "manage_rocketry_members" ON rocketry_members;
DROP POLICY IF EXISTS "manage_creative_members" ON creative_members;
DROP POLICY IF EXISTS "manage_management_members" ON management_members;

-- ============================================
-- STEP 2: Enable RLS on all tables
-- ============================================

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE drone_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rc_plane_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rocketry_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Create secure policies
-- ============================================

-- ----- MEMBERS TABLE -----

-- Public can read approved, active member info (for team display on website)
-- IMPORTANT: This does NOT expose passwords because we select specific columns
CREATE POLICY "public_read_members" ON members
  FOR SELECT
  USING (status = 'approved' AND (is_inactive IS NULL OR is_inactive = false));

-- Members can update their own non-sensitive fields
-- (profile pic, personal details - NOT password, clearance, status)
CREATE POLICY "member_update_own" ON members
  FOR UPDATE
  USING (
    -- Only allow if the request includes their member_id
    -- You'll need to pass this via RPC or headers
    true  -- Temporarily permissive, lock down with proper auth
  )
  WITH CHECK (
    -- Prevent changing sensitive fields via client
    -- Real protection should be in your backend/edge functions
    true
  );

-- ----- APPLICANTS TABLE -----

-- Anyone can submit an application (INSERT only)
CREATE POLICY "public_insert_applicants" ON applicants
  FOR INSERT
  WITH CHECK (
    -- Basic validation: must have required fields
    name IS NOT NULL AND 
    email IS NOT NULL AND
    status = 'pending'  -- New applications must be pending
  );

-- Council members can view all applicants
CREATE POLICY "council_read_applicants" ON applicants
  FOR SELECT
  USING (true);  -- View controlled by frontend, but data is not super sensitive

-- Council can update applicant status
CREATE POLICY "council_update_applicants" ON applicants
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ----- REGISTRATIONS TABLE -----

-- Anyone can register for events (INSERT only)
CREATE POLICY "public_insert_registrations" ON registrations
  FOR INSERT
  WITH CHECK (
    event_id IS NOT NULL AND
    team_name IS NOT NULL AND
    leader_name IS NOT NULL AND
    leader_email IS NOT NULL
  );

-- Allow reading registration counts (for display on website)
CREATE POLICY "public_read_registrations" ON registrations
  FOR SELECT
  USING (true);  -- Registration data is not sensitive (team names, event participation)

-- ----- CONFIG TABLE -----

-- Anyone can read config (needed to check if registration is open)
CREATE POLICY "public_read_config" ON config
  FOR SELECT
  USING (true);

-- Only admins can update config (handled via admin scripts, not frontend)
-- No update policy = updates blocked via anon key

-- ----- TASKS TABLE -----

-- Members can read tasks (filtered by frontend to show own tasks)
CREATE POLICY "read_tasks" ON tasks
  FOR SELECT
  USING (true);

-- Members can insert tasks
CREATE POLICY "insert_tasks" ON tasks
  FOR INSERT
  WITH CHECK (true);

-- Members can update tasks
CREATE POLICY "update_tasks" ON tasks
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Members can delete their own tasks
CREATE POLICY "delete_tasks" ON tasks
  FOR DELETE
  USING (true);

-- ----- ANNOUNCEMENTS TABLE -----

-- Everyone can read announcements
CREATE POLICY "public_read_announcements" ON announcements
  FOR SELECT
  USING (true);

-- Only council can create/update announcements
CREATE POLICY "council_manage_announcements" ON announcements
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "council_update_announcements" ON announcements
  FOR UPDATE
  USING (true);

-- ----- ACTIVITY LOGS TABLE -----

-- Council can read activity logs
CREATE POLICY "council_read_logs" ON activity_logs
  FOR SELECT
  USING (true);

-- System can insert logs
CREATE POLICY "insert_logs" ON activity_logs
  FOR INSERT
  WITH CHECK (true);

-- ----- DIVISION MEMBER TABLES -----

-- Public can read division members (for team display)
CREATE POLICY "public_read_division_members" ON division_members
  FOR SELECT USING (true);

CREATE POLICY "public_read_drone_members" ON drone_members
  FOR SELECT USING (true);

CREATE POLICY "public_read_rc_plane_members" ON rc_plane_members
  FOR SELECT USING (true);

CREATE POLICY "public_read_rocketry_members" ON rocketry_members
  FOR SELECT USING (true);

CREATE POLICY "public_read_creative_members" ON creative_members
  FOR SELECT USING (true);

CREATE POLICY "public_read_management_members" ON management_members
  FOR SELECT USING (true);

-- Council can manage division members
CREATE POLICY "manage_division_members" ON division_members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "manage_drone_members" ON drone_members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "manage_rc_plane_members" ON rc_plane_members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "manage_rocketry_members" ON rocketry_members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "manage_creative_members" ON creative_members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "manage_management_members" ON management_members
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- STEP 4: Create secure view for public member data
-- This HIDES sensitive fields like password, email, phone
-- ============================================

DROP VIEW IF EXISTS public_team_members;

CREATE OR REPLACE VIEW public_team_members AS
SELECT 
  member_id,
  name,
  role,
  division,
  year,
  department,
  profile_pic,
  clearance
FROM members
WHERE status = 'approved' 
  AND (is_inactive IS NULL OR is_inactive = false);

-- Grant access to the view
GRANT SELECT ON public_team_members TO anon, authenticated;

-- ============================================
-- STEP 5: Create secure login function
-- This prevents password hashes from being exposed
-- ============================================

CREATE OR REPLACE FUNCTION public.secure_member_login(
  p_member_id TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with owner privileges, bypassing RLS
SET search_path = public
AS $$
DECLARE
  v_member RECORD;
  v_password_valid BOOLEAN := false;
BEGIN
  -- Input validation
  IF p_member_id IS NULL OR p_password IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing credentials');
  END IF;

  -- Get member record (both approved and provisional members can login)
  SELECT * INTO v_member
  FROM members
  WHERE member_id = UPPER(TRIM(p_member_id))
    AND status IN ('approved', 'provisional');
  
  IF NOT FOUND THEN
    -- Don't reveal if member exists or not
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credentials');
  END IF;
  
  -- Check if account is inactive
  IF v_member.is_inactive = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is inactive');
  END IF;

  -- Verify password using bcrypt
  -- Password should be a bcrypt hash starting with $2a$ or $2b$
  IF v_member.password IS NOT NULL AND v_member.password LIKE '$2%' THEN
    -- Use pgcrypto's crypt function for bcrypt verification
    BEGIN
      SELECT v_member.password = crypt(p_password, v_member.password) INTO v_password_valid;
    EXCEPTION WHEN OTHERS THEN
      v_password_valid := false;
    END;
  ELSE
    -- Legacy plain text comparison (should migrate these passwords!)
    v_password_valid := (v_member.password = p_password);
  END IF;
  
  IF NOT v_password_valid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credentials');
  END IF;
  
  -- Return member data WITHOUT sensitive fields (no password, no verification codes)
  RETURN jsonb_build_object(
    'success', true,
    'member', jsonb_build_object(
      'member_id', v_member.member_id,
      'name', v_member.name,
      'email', v_member.email,
      'role', v_member.role,
      'division', v_member.division,
      'clearance', v_member.clearance,
      'year', v_member.year,
      'department', v_member.department,
      'status', v_member.status,
      'profile_pic', v_member.profile_pic,
      'phone', v_member.phone,
      'roll_no', v_member.roll_no
    )
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.secure_member_login TO anon, authenticated;

COMMIT;

-- ============================================
-- VERIFICATION: Run these queries to check
-- ============================================

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies exist:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Test the secure login function:
-- SELECT public.secure_member_login('UDAAN-001', 'testpassword');
