-- Migration: Add inactive status fields to members table
-- Run this on your Supabase/Postgres database

BEGIN;

-- Add is_inactive column (defaults to false = active)
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS is_inactive boolean DEFAULT false;

-- Add inactive_since column (timestamp when member was marked inactive)
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS inactive_since timestamptz;

-- Create index for faster filtering of inactive members
CREATE INDEX IF NOT EXISTS idx_members_inactive ON members (is_inactive);

-- Comment on columns for documentation
COMMENT ON COLUMN members.is_inactive IS 'Whether the member is currently marked as inactive';
COMMENT ON COLUMN members.inactive_since IS 'Timestamp when the member was marked inactive (null if active)';

COMMIT;

-- ===========================================
-- END OF MIGRATION
-- ===========================================
