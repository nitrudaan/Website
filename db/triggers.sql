-- Triggers and functions for UDAAN Website
-- Run AFTER setup.sql
-- These keep legacy per-division tables in sync with members.division

BEGIN;

-- Function to sync division tables when members.division changes
CREATE OR REPLACE FUNCTION sync_division_tables()
RETURNS TRIGGER AS $$
DECLARE
  div_list text[];
  div text;
BEGIN
  -- Remove from all division tables first (on UPDATE or DELETE)
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    DELETE FROM drone_members WHERE member_id = OLD.member_id;
    DELETE FROM rc_plane_members WHERE member_id = OLD.member_id;
    DELETE FROM rocketry_members WHERE member_id = OLD.member_id;
    DELETE FROM creative_members WHERE member_id = OLD.member_id;
    DELETE FROM management_members WHERE member_id = OLD.member_id;
    DELETE FROM division_members WHERE member_id = OLD.member_id;
  END IF;

  -- If DELETE, we're done
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- Parse comma-separated divisions and insert into appropriate tables
  IF NEW.division IS NOT NULL AND NEW.division != '' THEN
    div_list := string_to_array(NEW.division, ',');
    FOREACH div IN ARRAY div_list LOOP
      div := trim(div);
      
      -- Insert into general division_members table
      INSERT INTO division_members (division_name, member_id) VALUES (div, NEW.member_id)
      ON CONFLICT DO NOTHING;
      
      -- Insert into legacy per-division tables
      IF div ILIKE '%drone%' THEN
        INSERT INTO drone_members (member_id) VALUES (NEW.member_id) ON CONFLICT DO NOTHING;
      ELSIF div ILIKE '%rc%plane%' OR div ILIKE '%rcplane%' THEN
        INSERT INTO rc_plane_members (member_id) VALUES (NEW.member_id) ON CONFLICT DO NOTHING;
      ELSIF div ILIKE '%rocket%' THEN
        INSERT INTO rocketry_members (member_id) VALUES (NEW.member_id) ON CONFLICT DO NOTHING;
      ELSIF div ILIKE '%creative%' OR div ILIKE '%web%' THEN
        INSERT INTO creative_members (member_id) VALUES (NEW.member_id) ON CONFLICT DO NOTHING;
      ELSIF div ILIKE '%management%' THEN
        INSERT INTO management_members (member_id) VALUES (NEW.member_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_sync_divisions ON members;

-- Create trigger on members table
CREATE TRIGGER trg_sync_divisions
  AFTER INSERT OR UPDATE OF division OR DELETE ON members
  FOR EACH ROW
  EXECUTE FUNCTION sync_division_tables();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to members
DROP TRIGGER IF EXISTS trg_members_updated ON members;
CREATE TRIGGER trg_members_updated
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Apply updated_at trigger to site_settings
DROP TRIGGER IF EXISTS trg_settings_updated ON site_settings;
CREATE TRIGGER trg_settings_updated
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

COMMIT;
