-- DB setup for UDAAN Website
-- Run this on your Supabase/Postgres database (via psql or Supabase SQL editor)

-- Recommended: run inside a transaction in production
BEGIN;

-- Optional: pgcrypto for gen_random_uuid() if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- MEMBERS TABLE (core team members)
-- ===========================================
CREATE TABLE IF NOT EXISTS members (
  id serial,
  member_id varchar PRIMARY KEY, -- e.g. 'UDAAN-001', 'UDAAN-2001', 'UDAAN-3001'
  name varchar NOT NULL,
  email varchar, -- primary email (can be same as personal or institute)
  personal_email varchar,
  institute_email varchar,
  phone varchar,
  roll_no varchar, -- Note: code uses roll_no, not roll_number
  department varchar,
  year smallint,
  division text, -- comma-separated: 'Drone, Creative/Web-Dev'
  role varchar DEFAULT 'Member', -- Member, Head, Vice Head, etc.
  password varchar NOT NULL,
  clearance smallint DEFAULT 3, -- 5 = council, 3 = regular member
  status varchar DEFAULT 'pending', -- pending, approved, rejected
  email_verified boolean DEFAULT false,
  email_verification_code varchar,
  email_verification_expires timestamptz,
  phone_verified boolean DEFAULT false,
  password_history jsonb DEFAULT '[]'::jsonb, -- last 5 passwords for security
  profile_pic varchar,
  is_inactive boolean DEFAULT false, -- whether member is marked as inactive
  inactive_since timestamptz, -- timestamp when marked inactive
  added_by varchar,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_members_email ON members (lower(email));
CREATE INDEX IF NOT EXISTS idx_members_personal_email ON members (lower(personal_email));
CREATE INDEX IF NOT EXISTS idx_members_phone ON members (phone);
CREATE INDEX IF NOT EXISTS idx_members_roll ON members (roll_no);
CREATE INDEX IF NOT EXISTS idx_members_year ON members (year);
CREATE INDEX IF NOT EXISTS idx_members_status ON members (status);
CREATE INDEX IF NOT EXISTS idx_members_clearance ON members (clearance);
CREATE INDEX IF NOT EXISTS idx_members_division ON members (division);
CREATE INDEX IF NOT EXISTS idx_members_inactive ON members (is_inactive);

-- ===========================================
-- REGISTRATIONS TABLE (event registrations)
-- ===========================================
CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id varchar NOT NULL, -- 'aeroprix', 'hovermania', 'aviation-sim'
  team_name varchar NOT NULL,
  leader_name varchar NOT NULL,
  leader_email varchar NOT NULL,
  leader_phone varchar NOT NULL,
  leader_college varchar NOT NULL,
  leader_branch varchar,
  leader_year varchar,
  members jsonb DEFAULT '[]'::jsonb, -- array of { name, email, phone, college }
  registered_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations (event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations (lower(leader_email));

-- ===========================================
-- CONFIG TABLE (app settings)
-- ===========================================
CREATE TABLE IF NOT EXISTS config (
  id serial PRIMARY KEY,
  induction_open boolean DEFAULT false,
  registration_open boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
-- Insert default config if not exists
INSERT INTO config (id, induction_open, registration_open) 
VALUES (1, false, false)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- APPLICANTS TABLE (Join Corps applications)
-- ===========================================
CREATE TABLE IF NOT EXISTS applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  email varchar NOT NULL, -- personal email
  phone varchar,
  roll_no varchar,
  department varchar,
  year varchar, -- stored as string: '1', '2', '3', '4'
  interests jsonb DEFAULT '[]'::jsonb, -- array of division interests
  experience text,
  why_join text,
  status varchar DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by varchar,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_applicants_email ON applicants (lower(email));
CREATE INDEX IF NOT EXISTS idx_applicants_roll ON applicants (roll_no);
CREATE INDEX IF NOT EXISTS idx_applicants_status ON applicants (status);

-- ===========================================
-- DIVISION REQUESTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS division_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id varchar REFERENCES members(member_id) ON DELETE CASCADE,
  member_name varchar NOT NULL,
  division varchar NOT NULL, -- 'Drone', 'RC Plane', 'Rocketry', 'Management', 'Creative/Web-Dev'
  status varchar DEFAULT 'pending', -- pending, approved, rejected
  requested_at timestamptz DEFAULT now(),
  reviewed_by varchar,
  reviewed_at timestamptz,
  notes text
);
CREATE INDEX IF NOT EXISTS idx_divreq_member ON division_requests (member_id);
CREATE INDEX IF NOT EXISTS idx_divreq_status ON division_requests (status);
CREATE INDEX IF NOT EXISTS idx_divreq_division ON division_requests (division);

-- ===========================================
-- DIVISION MEMBERS TABLES (per-division membership)
-- ===========================================

-- Generic division_members table (preferred for queries across all divisions)
CREATE TABLE IF NOT EXISTS division_members (
  id serial PRIMARY KEY,
  division_name varchar NOT NULL,
  member_id varchar REFERENCES members(member_id) ON DELETE CASCADE,
  name varchar,
  role varchar DEFAULT 'Member',
  joined_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_division_members_member ON division_members (member_id);
CREATE INDEX IF NOT EXISTS idx_division_members_division ON division_members (division_name);

-- Legacy per-division tables (code uses these directly)
CREATE TABLE IF NOT EXISTS drone_members (
  member_id varchar PRIMARY KEY REFERENCES members(member_id) ON DELETE CASCADE,
  name varchar,
  role varchar DEFAULT 'Member',
  joined_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rc_plane_members (
  member_id varchar PRIMARY KEY REFERENCES members(member_id) ON DELETE CASCADE,
  name varchar,
  role varchar DEFAULT 'Member',
  joined_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rocketry_members (
  member_id varchar PRIMARY KEY REFERENCES members(member_id) ON DELETE CASCADE,
  name varchar,
  role varchar DEFAULT 'Member',
  joined_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS creative_members (
  member_id varchar PRIMARY KEY REFERENCES members(member_id) ON DELETE CASCADE,
  name varchar,
  role varchar DEFAULT 'Member',
  joined_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS management_members (
  member_id varchar PRIMARY KEY REFERENCES members(member_id) ON DELETE CASCADE,
  name varchar,
  role varchar DEFAULT 'Member',
  joined_at timestamptz DEFAULT now()
);

-- ===========================================
-- TASKS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar NOT NULL,
  description text,
  status varchar DEFAULT 'pending', -- pending, in-progress, completed
  priority varchar DEFAULT 'medium', -- low, medium, high
  category varchar,
  due_date timestamptz,
  assigned_to varchar REFERENCES members(member_id) ON DELETE SET NULL,
  assigned_by varchar, -- member_id of assigner or null
  assigned_by_name varchar, -- 'Self' or member name for display
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks (assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority);

-- ===========================================
-- ANNOUNCEMENTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar NOT NULL,
  content text NOT NULL,
  type varchar DEFAULT 'update', -- meeting, update, deadline, important
  date timestamptz NOT NULL, -- event/happening date
  created_by varchar REFERENCES members(member_id) ON DELETE SET NULL,
  created_by_name varchar, -- name for display
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_date ON announcements (date);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements (type);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements (created_by);

-- ===========================================
-- NOTIFICATIONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id varchar REFERENCES members(member_id) ON DELETE CASCADE,
  type varchar NOT NULL DEFAULT 'system', -- task_assigned, task_updated, announcement, mention, reminder, system
  title varchar NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  -- Announcement-specific metadata
  announcement_id uuid REFERENCES announcements(id) ON DELETE CASCADE,
  event_date timestamptz,
  announcement_type varchar, -- meeting, update, deadline, important
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_member ON notifications (member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type);
CREATE INDEX IF NOT EXISTS idx_notifications_announcement ON notifications (announcement_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at);

-- ===========================================
-- ACTIVITY LOGS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id varchar REFERENCES members(member_id) ON DELETE SET NULL,
  member_name varchar NOT NULL,
  action varchar NOT NULL, -- task_created, task_completed, announcement_created, member_added, login, etc.
  details text,
  target_type varchar, -- task, announcement, member, null
  target_id varchar,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_member ON activity_logs (member_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs (action);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs (created_at);

-- ===========================================
-- SITE SETTINGS TABLE (optional admin config)
-- ===========================================
CREATE TABLE IF NOT EXISTS site_settings (
  key varchar PRIMARY KEY,
  value jsonb,
  updated_at timestamptz DEFAULT now()
);

-- ===========================================
-- HELPER FUNCTION: Generate next member ID
-- ===========================================
CREATE OR REPLACE FUNCTION get_next_member_id()
RETURNS varchar AS $$
DECLARE
  max_num integer;
  new_id varchar;
BEGIN
  -- Get max number from council IDs (UDAAN-XXX format, not UDAAN-2XXX etc.)
  SELECT COALESCE(MAX(
    CASE 
      WHEN member_id ~ '^UDAAN-[0-9]{3}$' 
      THEN CAST(SUBSTRING(member_id FROM 7) AS integer)
      ELSE 0 
    END
  ), 0) INTO max_num
  FROM members;
  
  new_id := 'UDAAN-' || LPAD((max_num + 1)::text, 3, '0');
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ===========================================
-- END OF MIGRATION
-- ===========================================
