-- Migration: Add photo_uploaded_at for 1-year photo lock enforcement
-- Run this in Supabase SQL Editor to add the photo lock timestamp field

-- Add photo_uploaded_at column to members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS photo_uploaded_at timestamptz;

-- Add index for efficient querying of photo upload dates
CREATE INDEX IF NOT EXISTS idx_members_photo_uploaded ON members (photo_uploaded_at);

-- Create storage bucket for member photos (if not exists)
-- Note: This needs to be done via Supabase Dashboard or API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('member-photos', 'member-photos', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for member photos
-- These need to be created in Supabase Dashboard > Storage > Policies

-- Policy: Allow authenticated users to upload their own photos
-- CREATE POLICY "Members can upload their own photos" ON storage.objects
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'member-photos');

-- Policy: Allow public read access to photos
-- CREATE POLICY "Public read access for photos" ON storage.objects
--   FOR SELECT
--   TO public
--   USING (bucket_id = 'member-photos');

COMMENT ON COLUMN members.photo_uploaded_at IS 'Timestamp when profile photo was uploaded. Used to enforce 365-day photo lock.';
