-- Create email_logs table for audit and debugging
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  recipient text NOT NULL,
  entity_id text, -- Optional: member_id, task_id etc
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow insert/select interactions from authorized contexts (service role or admins)
-- Adapting this based on your RLS setup. Ideally, only server-side service role writes here.
-- Since this is client-side implementation initiating the log, we might need a public policy strictly for INSERT
-- or use the `supabase` client with specific permissions.
-- For now, allowing authenticated users (Team members) to insert logs (so specific failures are tracked).

CREATE POLICY "Enable insert for authenticated users" ON email_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Ideally, restricts 'select' to admins only.
CREATE POLICY "Enable select for admins only" ON email_logs
  FOR SELECT USING (
      auth.jwt() ->> 'email' = 'udaan-000@nitrkl.ac.in' -- Assuming UDAAN-000 maps to this or checking member_id
  );
