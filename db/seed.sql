-- ⚠️ SECURITY WARNING ⚠️
-- This file contains DEFAULT ADMIN CREDENTIALS
-- DO NOT deploy this file to production as-is!
-- After running this seed:
--   1. IMMEDIATELY change the default admin password
--   2. Remove or secure this file from production servers
--   3. Consider excluding this file from version control in sensitive environments

-- Seed data for UDAAN Website
-- Run AFTER setup.sql
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING where possible)

BEGIN;

-- ===========================================
-- SUPER ADMIN ACCOUNT (UDAAN-000)
-- This is the immutable admin account with highest authority
-- ===========================================
INSERT INTO members (
  member_id, 
  name, 
  email, 
  password, 
  role, 
  division, 
  year, 
  clearance, 
  status, 
  email_verified, 
  phone_verified
)
VALUES 
  (
    'UDAAN-000', 
    'UDAAN Administration', 
    'admin@udaan.nitrkl.ac.in', 
    'SuperAdminUDAANInitial2024', -- CHANGE THIS IMMEDIATELY!
    'Super Admin', 
    'Administration', 
    0, -- Not a regular member
    9, -- Highest clearance level (Super Admin)
    'approved',
    true, 
    true
  )
ON CONFLICT (member_id) DO NOTHING;

-- ===========================================
-- SAMPLE COUNCIL MEMBER (update credentials after first login!)
-- ===========================================
-- Password should be changed immediately after first login
INSERT INTO members (
  member_id, 
  name, 
  email, 
  password, 
  role, 
  division, 
  year, 
  clearance, 
  status, 
  email_verified, 
  phone_verified
)
VALUES 
  (
    'UDAAN-001', 
    'Admin User', 
    'admin@udaan.club', 
    'admin123', -- CHANGE THIS IMMEDIATELY!
    'President', 
    'Management', 
    3, -- Council members are typically 3rd year
    5, -- Council level clearance
    'approved',
    true, 
    true
  )
ON CONFLICT (member_id) DO NOTHING;

-- Add admin to management division table
INSERT INTO management_members (member_id) 
VALUES ('UDAAN-001')
ON CONFLICT (member_id) DO NOTHING;

-- Example division heads (commented out - uncomment and edit as needed)
-- INSERT INTO members (member_id, name, email, password, role, division, year, clearance, status)
-- VALUES 
--   ('UDAAN-002', 'Drone Lead', 'drone@udaan.club', 'changeme', 'Head', 'Drone', 3, 5, 'approved'),
--   ('UDAAN-003', 'RC Plane Lead', 'rcplane@udaan.club', 'changeme', 'Head', 'RC Plane', 3, 5, 'approved'),
--   ('UDAAN-004', 'Rocketry Lead', 'rocketry@udaan.club', 'changeme', 'Head', 'Rocketry', 3, 5, 'approved'),
--   ('UDAAN-005', 'Creative Lead', 'creative@udaan.club', 'changeme', 'Head', 'Creative/Web-Dev', 3, 5, 'approved')
-- ON CONFLICT (member_id) DO NOTHING;

COMMIT;
