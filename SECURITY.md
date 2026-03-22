# 🔒 Security Hardening Guide for Udaan Website

This document outlines critical security improvements needed to properly secure your Udaan website.

---

## 🚨 CRITICAL ISSUES FOUND

### 1. **RLS Policies Are Too Permissive**
Your current `fix_rls.sql` has policies like:
```sql
CREATE POLICY "Allow all operations on members" ON members
  FOR ALL USING (true) WITH CHECK (true);
```
This allows **ANYONE** with your anon key to read, modify, or delete ANY data!

### 2. **Passwords in Plain Text via API**
The `members` table stores hashed passwords, but since RLS allows full access, anyone can query and see the hashed passwords.

### 3. **Predictable Temporary Passwords**
```typescript
const tempPassword = `${safeFirst}123`;  // e.g., "john123"
```
This is extremely easy to guess!

---

## ✅ STEP-BY-STEP FIXES

### Step 1: Fix Supabase RLS Policies

Run this SQL in your Supabase SQL Editor to replace the insecure policies:

```sql
-- ============================================
-- SECURE RLS POLICIES FOR UDAAN
-- Run this AFTER your setup.sql
-- ============================================

-- First, enable RLS on all tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_members ENABLE ROW LEVEL SECURITY;

-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "Allow all operations on members" ON members;
DROP POLICY IF EXISTS "Allow all operations on applicants" ON applicants;

-- ============================================
-- MEMBERS TABLE POLICIES
-- ============================================

-- Public can only read non-sensitive member info (for team display)
CREATE POLICY "Public read non-sensitive member data" ON members
  FOR SELECT
  USING (
    status = 'approved' AND is_inactive = false
  );

-- Create a secure view for public member display (hides sensitive fields)
CREATE OR REPLACE VIEW public_members AS
SELECT 
  member_id,
  name,
  role,
  division,
  year,
  profile_pic,
  department
FROM members
WHERE status = 'approved' AND is_inactive = false;

-- Members can read their own full data
CREATE POLICY "Members read own data" ON members
  FOR SELECT
  USING (
    -- This requires you to pass member_id in request headers or use Supabase Auth
    member_id = current_setting('request.jwt.claims', true)::json->>'member_id'
  );

-- Only council (clearance >= 5) can modify members
CREATE POLICY "Council can manage members" ON members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.member_id = current_setting('request.jwt.claims', true)::json->>'member_id'
      AND m.clearance >= 5
    )
  );

-- ============================================
-- APPLICANTS TABLE POLICIES  
-- ============================================

-- Anyone can insert (submit application)
CREATE POLICY "Anyone can apply" ON applicants
  FOR INSERT
  WITH CHECK (true);

-- Only council can view/manage applicants
CREATE POLICY "Council can manage applicants" ON applicants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.member_id = current_setting('request.jwt.claims', true)::json->>'member_id'
      AND m.clearance >= 4
    )
  );

CREATE POLICY "Council can update applicants" ON applicants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.member_id = current_setting('request.jwt.claims', true)::json->>'member_id'
      AND m.clearance >= 4
    )
  );

-- ============================================
-- REGISTRATIONS TABLE POLICIES
-- ============================================

-- Anyone can register for events
CREATE POLICY "Anyone can register" ON registrations
  FOR INSERT
  WITH CHECK (true);

-- Only council can view registrations
CREATE POLICY "Council can view registrations" ON registrations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.member_id = current_setting('request.jwt.claims', true)::json->>'member_id'
      AND m.clearance >= 4
    )
  );

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================

-- Members can only see their own tasks
CREATE POLICY "Members see own tasks" ON tasks
  FOR SELECT
  USING (
    assigned_to = current_setting('request.jwt.claims', true)::json->>'member_id'
    OR assigned_by = current_setting('request.jwt.claims', true)::json->>'member_id'
  );

-- Council can see all tasks
CREATE POLICY "Council sees all tasks" ON tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m 
      WHERE m.member_id = current_setting('request.jwt.claims', true)::json->>'member_id'
      AND m.clearance >= 4
    )
  );
```

### Step 2: Create a Secure Login Function

Instead of exposing password hashes, create a database function:

```sql
-- Secure login function that never exposes password hash
CREATE OR REPLACE FUNCTION secure_login(
  p_member_id TEXT,
  p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges
AS $$
DECLARE
  v_member RECORD;
  v_valid BOOLEAN;
BEGIN
  -- Get member (including password for verification)
  SELECT * INTO v_member
  FROM members
  WHERE member_id = p_member_id
  AND status = 'approved';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid credentials');
  END IF;
  
  -- Verify password using pgcrypto
  SELECT v_member.password = crypt(p_password, v_member.password) INTO v_valid;
  
  IF NOT v_valid THEN
    RETURN json_build_object('success', false, 'error', 'Invalid credentials');
  END IF;
  
  -- Return member data WITHOUT password
  RETURN json_build_object(
    'success', true,
    'member', json_build_object(
      'member_id', v_member.member_id,
      'name', v_member.name,
      'email', v_member.email,
      'role', v_member.role,
      'clearance', v_member.clearance,
      'division', v_member.division
    )
  );
END;
$$;

-- Grant execute to anon (but function controls what data is returned)
GRANT EXECUTE ON FUNCTION secure_login TO anon;
```

### Step 3: Generate Strong Random Passwords

Update your code to use cryptographically secure passwords:

```typescript
// In utils/supabase.ts - Replace the weak password generation

function generateSecurePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*';
  const all = uppercase + lowercase + numbers + symbols;
  
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  // Ensure at least one of each type
  let password = '';
  password += uppercase[array[0] % uppercase.length];
  password += lowercase[array[1] % lowercase.length];
  password += numbers[array[2] % numbers.length];
  password += symbols[array[3] % symbols.length];
  
  // Fill rest randomly
  for (let i = 4; i < length; i++) {
    password += all[array[i] % all.length];
  }
  
  // Shuffle the password
  return password.split('').sort(() => crypto.getRandomValues(new Uint8Array(1))[0] - 128).join('');
}
```

### Step 4: Set Up Supabase Auth (Recommended)

Instead of custom password handling, use Supabase's built-in auth:

1. Go to Supabase Dashboard → Authentication → Settings
2. Enable Email provider
3. Update your code to use `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()`

This gives you:
- Secure password hashing (bcrypt with proper salt)
- JWT tokens for session management
- Built-in password reset flow
- Rate limiting on auth endpoints

### Step 5: Environment Variable Checklist

Run these commands to verify your setup:

```bash
# Check .env is not tracked
git ls-files | grep -E "\.env$|\.env\.local$"
# Should return NOTHING

# Verify .gitignore includes env files
cat .gitignore | grep -E "^\.env"
# Should show .env entries

# Check no secrets in code
grep -r "supabase.co" --include="*.ts" --include="*.tsx" .
# Should only show import.meta.env usage, NO hardcoded URLs
```

### Step 6: Additional Supabase Dashboard Settings

1. **API Settings** (Settings → API):
   - ✅ Enable "Enforce SSL connections"
   - ✅ Set "Request rate limit" (e.g., 100 requests/minute)

2. **Auth Settings** (Authentication → Settings):
   - ✅ Enable "Confirm email" for new signups
   - ✅ Set password minimum length to 8+
   - ✅ Enable "Leaked password protection"

3. **Database Settings**:
   - ✅ Enable "Connection pooling" (PgBouncer)
   - ✅ Set appropriate connection limits

---

## 🔐 Quick Security Checklist

| Item | Status | Action |
|------|--------|--------|
| RLS enabled on all tables | ⚠️ | Run secure RLS SQL above |
| RLS policies restrict access | ❌ | Replace "USING (true)" policies |
| Passwords not exposed via API | ❌ | Create secure_login function |
| Strong password generation | ❌ | Use crypto.getRandomValues |
| Environment variables secured | ✅ | Already in .gitignore |
| Source maps disabled in prod | ✅ | Fixed in vite.config.ts |
| Console logs stripped | ✅ | Terser configured |
| CSP headers added | ✅ | Added to index.html |
| Rate limiting | ⚠️ | Add via Supabase + client-side |

---

## 📞 Need Help?

If you're unsure about implementing these changes:
1. **Test in a staging environment first**
2. **Back up your database** before running RLS changes
3. **Test all features** after applying policies

The most critical fix is the RLS policies - without proper policies, anyone with your Supabase anon key can access ALL your data!
