-- UDAAN Database Cleanup Script
-- Run this in Supabase SQL Editor to reset activity/tasks data
-- WARNING: This will delete all tasks, activity logs, and notifications

-- 1. First, ensure the photo columns exist
ALTER TABLE members ADD COLUMN IF NOT EXISTS profile_pic TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS photo_uploaded_at TIMESTAMPTZ;

-- 2. Delete all tasks
DELETE FROM tasks;

-- 3. Delete all activity logs (table name is activity_logs with 's')
DELETE FROM activity_logs;

-- 4. Delete all notifications
DELETE FROM notifications;

-- 5. Delete all announcements (optional - uncomment if needed)
-- DELETE FROM announcements;

-- 6. Delete all division requests (optional - uncomment if needed)
-- DELETE FROM division_requests;

-- 7. Reset photo_uploaded_at for all members (allow fresh uploads)
UPDATE members SET photo_uploaded_at = NULL, profile_pic = NULL;

-- Verify cleanup
SELECT 'Tasks remaining:' as info, COUNT(*) as count FROM tasks
UNION ALL
SELECT 'Activity logs remaining:', COUNT(*) FROM activity_logs
UNION ALL
SELECT 'Notifications remaining:', COUNT(*) FROM notifications;
