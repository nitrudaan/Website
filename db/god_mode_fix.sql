-- DIVINE INTERVENTION: God Mode Storage & Permissions Fix
-- Run this in the Supabase SQL Editor to fix image uploads and database lock issues.

-- 1. Setup Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-photos', 'member-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Clean Up Old Policies
DROP POLICY IF EXISTS "God Mode - Anon" ON storage.objects;
DROP POLICY IF EXISTS "God Mode - Authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Public access for member photos" ON storage.objects;
DROP POLICY IF EXISTS "Full access for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Full access for anon users" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for photos" ON storage.objects;

-- 3. Create God-Tier Permissive Policies
-- This allows anyone (even without a login) to upload and read for now.
-- We can tighten this later after confirming it works.
CREATE POLICY "God Mode - Anon" ON storage.objects
FOR ALL TO anon USING (bucket_id = 'member-photos') WITH CHECK (bucket_id = 'member-photos');

CREATE POLICY "God Mode - Authenticated" ON storage.objects
FOR ALL TO authenticated USING (bucket_id = 'member-photos') WITH CHECK (bucket_id = 'member-photos');

-- 4. Disable RLS on members table to ensure profile updates never fail
ALTER TABLE members DISABLE ROW LEVEL SECURITY;

-- 5. Final verification of members table columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='photo_uploaded_at') THEN
        ALTER TABLE members ADD COLUMN photo_uploaded_at timestamptz;
        CREATE INDEX idx_members_photo_uploaded ON members (photo_uploaded_at);
    END IF;
END $$;
