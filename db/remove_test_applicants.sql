-- Remove test applicants added for induction testing
-- Run this in Supabase SQL editor to delete the four test applicants
-- IMPORTANT: Do NOT paste psql meta-commands (backslash commands) such as
-- "\set ON_ERROR_STOP on" into the Supabase SQL editor. Those are
-- client-side psql commands and will cause a syntax error (e.g., 42601).
-- If you want psql-style behavior, run this file locally with the `psql`
-- client instead.

BEGIN;

DELETE FROM applicants
WHERE email IN (
  'arjun.mehta@test.com',
  'priya.sharma@test.com',
  'rahul.verma@test.com',
  'sneha.patel@test.com'
);

COMMIT;

-- Verify removal
SELECT name, email, created_at FROM applicants WHERE email IN (
  'arjun.mehta@test.com',
  'priya.sharma@test.com',
  'rahul.verma@test.com',
  'sneha.patel@test.com'
);