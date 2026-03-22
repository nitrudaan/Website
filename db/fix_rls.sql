-- Fix RLS (Row Level Security) for division tables
-- Run this in Supabase SQL Editor to allow inserts/updates/deletes

-- Option 1: Disable RLS entirely on division tables (simpler, less secure)
-- Uncomment these if you want to disable RLS:

-- ALTER TABLE division_members DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE drone_members DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE rc_plane_members DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE rocketry_members DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE creative_members DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE management_members DISABLE ROW LEVEL SECURITY;

-- Option 2: Create policies to allow all operations (recommended)
-- This allows authenticated users to perform all operations

-- division_members policies
ALTER TABLE division_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on division_members" ON division_members;
CREATE POLICY "Allow all operations on division_members" ON division_members
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- drone_members policies
ALTER TABLE drone_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on drone_members" ON drone_members;
CREATE POLICY "Allow all operations on drone_members" ON drone_members
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- rc_plane_members policies
ALTER TABLE rc_plane_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on rc_plane_members" ON rc_plane_members;
CREATE POLICY "Allow all operations on rc_plane_members" ON rc_plane_members
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- rocketry_members policies
ALTER TABLE rocketry_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on rocketry_members" ON rocketry_members;
CREATE POLICY "Allow all operations on rocketry_members" ON rocketry_members
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- creative_members policies
ALTER TABLE creative_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on creative_members" ON creative_members;
CREATE POLICY "Allow all operations on creative_members" ON creative_members
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- management_members policies
ALTER TABLE management_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on management_members" ON management_members;
CREATE POLICY "Allow all operations on management_members" ON management_members
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Also ensure members table has proper policies
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on members" ON members;
CREATE POLICY "Allow all operations on members" ON members
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions to anon and authenticated roles
GRANT ALL ON division_members TO anon, authenticated;
GRANT ALL ON drone_members TO anon, authenticated;
GRANT ALL ON rc_plane_members TO anon, authenticated;
GRANT ALL ON rocketry_members TO anon, authenticated;
GRANT ALL ON creative_members TO anon, authenticated;
GRANT ALL ON management_members TO anon, authenticated;
GRANT ALL ON members TO anon, authenticated;
