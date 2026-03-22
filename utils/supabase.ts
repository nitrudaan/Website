/**
 * Supabase Client Configuration
 * Used for database operations (auth, registrations, config, etc.)
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

/**
 * Generate a cryptographically secure random password
 * Uses Web Crypto API for true randomness
 */
function generateSecurePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';
  const all = uppercase + lowercase + numbers + symbols;

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  // Ensure at least one of each type for password strength
  let password = '';
  password += uppercase[array[0] % uppercase.length];
  password += lowercase[array[1] % lowercase.length];
  password += numbers[array[2] % numbers.length];
  password += symbols[array[3] % symbols.length];

  // Fill rest randomly
  for (let i = 4; i < length; i++) {
    password += all[array[i] % all.length];
  }

  // Shuffle the password using Fisher-Yates
  const chars = password.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const randomArray = new Uint8Array(1);
    crypto.getRandomValues(randomArray);
    const j = randomArray[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/**
 * Promote an applicant to Stage 2 by creating a provisional member account and
 * returning the temporary password so the caller can email it to the applicant.
 */
export async function promoteApplicantToStage2(applicantId: string, addedBy: string): Promise<{ success: boolean; member?: Member; tempPassword?: string; error?: string }> {
  // Fetch applicant
  const { data: applicant, error: fetchErr } = await supabase
    .from('applicants')
    .select('*')
    .eq('id', applicantId)
    .single();

  if (fetchErr || !applicant) {
    return { success: false, error: 'Applicant not found' };
  }
  // Ensure the applicant has provided and verified an email
  if (!(applicant as any).email) {
    return { success: false, error: 'Applicant has no email on file' };
  }

  if (!((applicant as any).email_verified)) {
    return { success: false, error: 'Applicant email not verified' };
  }

  // Generate secure random temporary password
  const tempPassword = generateSecurePassword(12);
  const bcrypt = await import('bcryptjs');
  const hashed = await bcrypt.hash(tempPassword, 10);

  // Determine numeric year from applicant.year string
  let numericYear = 1;
  const yearStr = String((applicant as any).year || '1');
  if (yearStr.includes('2')) numericYear = 2;
  else if (yearStr.includes('3')) numericYear = 3;
  else if (yearStr.includes('4')) numericYear = 4;

  // Create provisional member (status = 'provisional')
  // Store all selected interests as comma-separated string for proper test visibility
  const addResult = await addMemberWithYear({
    name: (applicant as any).name,
    email: (applicant as any).email,
    password: hashed,
    role: 'Member',
    division: Array.isArray((applicant as any).interests) && (applicant as any).interests.length > 0 ? (applicant as any).interests.join(', ') : 'Unassigned',
    year: numericYear,
    added_by: addedBy,
    isCouncil: false,
    roll_no: (applicant as any).roll_no || undefined,
    department: (applicant as any).department || undefined,
    institute_email: undefined,
    status: 'provisional'
  });

  if (!addResult.success || !addResult.member) {
    return { success: false, error: addResult.error || 'Failed to create provisional member' };
  }

  // Update applicant record to mark reviewed/approved and reference member_id in notes
  const notes = `Promoted to Stage 2 -> ${addResult.member.member_id}`;
  await supabase
    .from('applicants')
    .update({ status: 'approved', reviewed_by: addedBy, reviewed_at: new Date().toISOString(), notes })
    .eq('id', applicantId);

  return { success: true, member: addResult.member, tempPassword };
}

/**
 * Count provisional members (used to indicate Stage 2 availability)
 */
export async function getProvisionalMembersCount(): Promise<number> {
  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'provisional');

  if (error) {
    console.error('Error counting provisional members:', error);
    return 0;
  }

  return count || 0;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for database tables
export interface Member {
  id: string;
  member_id: string;
  name: string;
  email: string;
  personal_email?: string;
  institute_email?: string;
  roll_no?: string;
  phone?: string;
  department?: string;
  password: string;
  role: string;
  division: string;
  clearance: number;
  year: number;
  status: 'pending' | 'approved' | 'rejected' | 'provisional';
  added_by?: string;
  created_at: string;
  email_verified?: boolean;
  email_verification_code?: string;
  email_verification_expires?: string;
  phone_verified?: boolean;
  // Photo fields for ID card
  profile_pic?: string; // URL to WebP photo in storage
  photo_uploaded_at?: string; // Timestamp when photo was uploaded (for 1-year lock)
  // Inactive status fields
  is_inactive?: boolean; // Whether member is marked as inactive
  inactive_since?: string; // Timestamp when marked inactive (ISO string)
}

/**
 * Approve a provisional member -> Full Member
 * - Updates status to 'approved'
 * - Sets clearance to 2 (1st Year Level)
 * - Sets year to 1
 * - Sets email_verified to true
 * - Updates division and ensures they are in the division table
 */
export async function approveProvisionalMember(memberId: string, division: string): Promise<{ success: boolean; message: string }> {
  // 1. Details First
  const { data: member } = await supabase
    .from('members')
    .select('name, email')
    .eq('member_id', memberId)
    .single();

  const memberName = member?.name || 'Unknown';
  const memberEmail = member?.email || '';

  // 2. Parallel Actions: Update Profile & Cleanup Old Divisions
  const updateProfilePromise = supabase
    .from('members')
    .update({
      status: 'approved',
      clearance: 2,
      year: 1,
      role: 'Member',
      division: division,
      email_verified: true,
      email_verification_code: null
    })
    .eq('member_id', memberId);

  const cleanupPromise = removeMemberFromAllDivisionTables(memberId);

  const [updateResult] = await Promise.all([updateProfilePromise, cleanupPromise]);

  if (updateResult.error) {
    console.error('Error approving provisional member:', updateResult.error);
    return { success: false, message: 'Failed to update member status' };
  }

  // 3. Parallel Division Insertions
  const divisions = division.split(',').map(d => d.trim());

  const insertionPromises = divisions.map(div => {
    if (!div) return Promise.resolve(true);

    let matchedKey = Object.keys(DIVISION_TABLE_MAP).find(k => k.toLowerCase() === div.toLowerCase());
    if (!matchedKey && (div.toLowerCase().includes('creative') || div.toLowerCase().includes('web'))) {
      matchedKey = 'Creative/Web-Dev';
    }

    if (matchedKey) {
      return addMemberToDivisionTable(memberId, memberName, matchedKey, 'Member');
    }
    return Promise.resolve(true); // Skip unknown divisions
  });

  await Promise.all(insertionPromises);

  // 4. Send Email Notification (Fire and Forget)
  if (memberEmail) {
    import('./email').then(({ sendInductionSuccessEmail }) => {
      sendInductionSuccessEmail(memberEmail, memberName, memberId);
    });
  }

  return { success: true, message: 'Member successfully approved and added to the club!' };
}

/**
 * Get all provisional members (for President's approval list)
 * NOTE: Admin function - returns fields needed for approval workflow
 */
export async function getProvisionalMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('member_id, name, email, personal_email, institute_email, role, division, clearance, year, department, status, created_at, phone, roll_no, profile_pic, email_verified')
    .eq('status', 'provisional')
    .order('member_id', { ascending: true });

  if (error) {
    return [];
  }

  return data as Member[];
}

export interface Registration {
  id: string;
  event_id: string;
  team_name: string;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  leader_college: string;
  leader_branch?: string;
  leader_year?: string;
  members: Array<{
    name: string;
    email: string;
    phone: string;
    college: string;
  }>;
  registered_at: string;
}

export interface Config {
  id: number;
  induction_open: boolean;
  registration_open: boolean;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  category: string;
  due_date: string;
  assigned_to: string; // member_id of assignee
  assigned_by: string; // member_id of assigner (council member) or 'Self'
  assigned_by_name: string; // name of assigner for display
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'meeting' | 'update' | 'deadline' | 'important';
  date: string;
  created_by: string; // member_id of creator
  created_by_name: string; // name of creator for display
  created_at: string;
}

export interface Applicant {
  id: string;
  name: string;
  email: string; // personal email
  phone: string;
  roll_no: string;
  department: string;
  year: string;
  interests: string[]; // array of division interests
  experience: string;
  why_join: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
  created_at: string;
  email_verified?: boolean;
}

export interface DivisionRequest {
  id: string;
  member_id: string;
  member_name: string;
  division: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
}

// Division heads mapping
export const DIVISION_HEADS: { [key: string]: { name: string; member_id: string } } = {
  'Creative/Web-Dev': { name: 'Nirav', member_id: 'UDAAN-003' },
  'Management': { name: 'Deepa', member_id: 'UDAAN-004' },
  'RC Plane': { name: 'M Sai', member_id: 'UDAAN-006' },
  'Rocketry': { name: 'Amrit', member_id: 'UDAAN-007' },
  'Drone': { name: 'Tanya', member_id: 'UDAAN-005' },
};

// Helper functions

/**
 * Authenticate a member by member_id and password
 * Uses client-side bcrypt verification (bcryptjs) since PostgreSQL crypt() 
 * doesn't support bcryptjs-generated hashes properly
 */
export async function loginMember(memberId: string, password: string): Promise<Member | null> {
  // Fetch member with password for verification (password is excluded from response to client)
  const { data, error } = await supabase
    .from('members')
    .select('member_id, name, email, personal_email, institute_email, role, division, clearance, year, department, status, profile_pic, phone, roll_no, email_verified, password')
    .eq('member_id', memberId.toUpperCase())
    .eq('status', 'approved')
    .single();

  if (error || !data) {
    return null;
  }

  const storedPass = (data as any).password || '';

  try {
    let isValid = false;

    // Verify password with bcrypt
    if (storedPass.startsWith('$2')) {
      isValid = await bcrypt.compare(password, storedPass);
    } else {
      // Plain text fallback (legacy)
      isValid = (password === storedPass);
    }

    if (!isValid) return null;

    // Return member WITHOUT password
    const { password: _, ...memberWithoutPassword } = data as any;
    return memberWithoutPassword as Member;
  } catch (err) {
    return null;
  }
}

/**
 * Authenticate a provisional member (Stage 2) — members with status 'provisional'
 */
export async function loginProvisional(memberId: string, password: string): Promise<Member | null> {
  const { data, error } = await supabase
    .from('members')
    .select('member_id, name, email, personal_email, institute_email, role, division, clearance, year, department, status, profile_pic, phone, roll_no, email_verified, password')
    .eq('member_id', memberId.toUpperCase())
    .eq('status', 'provisional')
    .single();

  if (error || !data) return null;

  const storedPass = (data as any).password || '';

  try {
    let isValid = false;

    if (storedPass.startsWith('$2')) {
      isValid = await bcrypt.compare(password, storedPass);
    } else {
      isValid = (password === storedPass);
    }

    if (!isValid) return null;

    const { password: _, ...memberWithoutPassword } = data as any;
    return memberWithoutPassword as Member;
  } catch (err) {
    return null;
  }
}

/**
 * Get all approved members
 * NOTE: Excludes UDAAN-000 (system admin) - it should never appear in member lists
 * NOTE: Only returns members with status = 'approved' - provisional members are excluded
 * SECURITY: Only fetches non-sensitive fields
 */
export async function getMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')  // Use members table to get contact info
    .select('member_id, name, role, division, year, department, profile_pic, clearance, phone, personal_email, roll_no, status, is_inactive, inactive_since')
    .eq('status', 'approved') // CRITICAL: Only approved members - excludes provisional/pending/rejected
    .neq('member_id', 'UDAAN-000')
    .order('member_id', { ascending: true });

  if (error) {
    return [];
  }

  return data as Member[];
}

/**
 * Get active members only (excludes alumni and UDAAN-000)
 * This is used for task assignment and active member lists
 * NOTE: UDAAN-000 is excluded - it's a system admin, not assignable
 * NOTE: Only returns members with status = 'approved' - provisional members are excluded
 * SECURITY: Only fetches non-sensitive fields
 */
export async function getActiveMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')  // Use members table to get contact info
    .select('member_id, name, role, division, year, department, profile_pic, clearance, phone, personal_email, roll_no, status, is_inactive, inactive_since')
    .eq('status', 'approved') // CRITICAL: Only approved members - excludes provisional/pending/rejected
    .neq('member_id', 'UDAAN-000')
    .neq('role', 'Alumni')
    .neq('year', 0)
    .order('member_id', { ascending: true });

  if (error) {
    return [];
  }

  return data as Member[];
}

/**
 * Get council members (clearance level 5)
 * Returns members with their roles and profile photos for the council section
 * Role-based slot mapping: President, Vice President, Creative Head, Management Lead, Drone Lead, RC Lead, Rocket Lead
 * NOTE: Secretary is a tag only, not a separate position
 * SECURITY: Only fetches non-sensitive fields
 */
export async function getCouncilMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('public_team_members')  // Use secure view that excludes sensitive fields
    .select('member_id, name, role, division, year, department, profile_pic, clearance')
    .eq('clearance', 5)
    .neq('member_id', 'UDAAN-000')
    .order('member_id', { ascending: true });

  if (error) {
    return [];
  }

  return data as Member[];
}

/**
 * Get alumni members only
 * NOTE: UDAAN-000 is never included here
 * NOTE: Only returns members with status = 'approved' - provisional members are excluded
 * SECURITY: Only fetches non-sensitive fields
 */
export async function getAlumniMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')  // Use members table to get contact info
    .select('member_id, name, role, division, year, department, profile_pic, clearance, phone, personal_email, roll_no, status')
    .eq('status', 'approved') // CRITICAL: Only approved members - excludes provisional/pending/rejected
    .eq('role', 'Alumni')
    .neq('member_id', 'UDAAN-000')
    .order('member_id', { ascending: true });

  if (error) {
    return [];
  }

  return data as Member[];
}

/**
 * Get members assignable for tasks (excludes alumni, 4th years, and super admin)
 * This is used when council/4th year assigns tasks to others
 * NOTE: UDAAN-000 cannot be assigned tasks - it's a system admin
 * NOTE: 4th year members cannot be assigned tasks (they are task assigners)
 * NOTE: Alumni cannot be assigned tasks (inactive members)
 * SECURITY: Only fetches non-sensitive fields needed for task assignment
 */
export async function getAssignableMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('public_team_members')  // Use secure view
    .select('member_id, name, role, division, year, department, profile_pic, clearance')
    .neq('member_id', 'UDAAN-000')
    .neq('role', 'Alumni')
    .neq('year', 0)
    .neq('year', 4)
    .order('member_id', { ascending: true });

  if (error) {
    return [];
  }

  return data as Member[];
}

/**
 * Get pending member applications
 * NOTE: This is admin-only - fetches from members table with limited fields
 */
export async function getPendingMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('member_id, name, email, role, division, year, department, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    return [];
  }

  return data as Member[];
}

/**
 * Add a new member (generates UDAAN-XXX ID)
 */
export async function addMember(member: {
  name: string;
  email: string;
  password: string;
  role: string;
  division: string;
  added_by: string;
}): Promise<Member | null> {
  // Get next member ID
  const { data: idData, error: idError } = await supabase.rpc('get_next_member_id');

  if (idError) {
    console.error('Error generating member ID:', idError);
    return null;
  }

  const memberId = idData as string;

  // Insert new member
  const { data, error } = await supabase
    .from('members')
    .insert([{
      member_id: memberId,
      name: member.name,
      email: member.email,
      password: member.password,
      role: member.role,
      division: member.division,
      clearance: 5,
      status: 'approved',
      added_by: member.added_by
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding member:', error);
    return null;
  }

  return data as Member;
}

/**
 * Add a new member with year-based ID format
 * - Council (3rd year with council role): UDAAN-XXX
 * - 1st year: UDAAN-1XXX
 * - 2nd year: UDAAN-2XXX
 * - 3rd year (non-council): UDAAN-3XXX
 * - 4th year: UDAAN-4XXX
 * 
 * NOTE: 5th year has been removed - members graduate to Alumni after 4th year
 */
/**
 * Add a new member with year-based ID generation
 * 
 * ROOT CAUSE FIX for "Failed to add member" error:
 * - Issue 1: Race condition when multiple inserts happen simultaneously
 * - Issue 2: ID collision from random number fallback
 * - Issue 3: Incorrect number parsing for ID generation
 * 
 * Solution: Use deterministic sequential IDs with collision retry logic
 */
export async function addMemberWithYear(member: {
  name: string;
  email: string;
  password: string;
  role: string;
  division: string;
  year: number;
  added_by: string;
  isCouncil?: boolean; // Only true for 3rd year council members
  roll_no?: string;
  department?: string;
  institute_email?: string;
  status?: 'approved' | 'pending' | 'provisional' | 'rejected';
}): Promise<{ success: boolean; member?: Member; error?: string }> {
  // Validate year (1-4 only, 5th year removed - becomes Alumni)
  if (member.year < 1 || member.year > 4) {
    console.error('Invalid year: Only years 1-4 are valid for new members');
    return { success: false, error: 'Invalid year: Only years 1-4 are valid for new members' };
  }

  // Validate required fields
  if (!member.name || member.name.trim() === '') {
    return { success: false, error: 'Name is required' };
  }
  if (!member.email || member.email.trim() === '') {
    return { success: false, error: 'Email is required' };
  }
  if (!member.password || member.password.trim() === '') {
    return { success: false, error: 'Password is required' };
  }
  if (!member.division || member.division.trim() === '') {
    return { success: false, error: 'At least one division is required' };
  }

  // Check if email already exists
  const { data: existingEmail } = await supabase
    .from('members')
    .select('member_id, name')
    .eq('email', member.email)
    .single();

  if (existingEmail) {
    return { success: false, error: `Email already exists for member ${existingEmail.name} (${existingEmail.member_id})` };
  }

  // Check if roll number already exists (if provided)
  if (member.roll_no) {
    const { data: existingRollNo } = await supabase
      .from('members')
      .select('member_id, name')
      .eq('roll_no', member.roll_no.toUpperCase())
      .single();

    if (existingRollNo) {
      return { success: false, error: `Roll number already exists for member ${existingRollNo.name} (${existingRollNo.member_id})` };
    }
  }

  // Determine clearance based on council status
  const clearance = member.isCouncil ? 5 : 3;

  // Get the ID prefix based on year and council status
  // Council members (3rd year with isCouncil=true): UDAAN-XXX
  // Non-council members: UDAAN-{year}XXX (e.g., UDAAN-1001, UDAAN-2001, UDAAN-3001, UDAAN-4001)
  const isCouncilMember = member.isCouncil && member.year === 3;

  // FIX: Retry logic for ID collision (up to 5 attempts)
  const maxRetries = 5;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let memberId: string;

    if (isCouncilMember) {
      // Council members use UDAAN-XXX format (001-099)
      const { data: existingCouncil, error: fetchCouncilError } = await supabase
        .from('members')
        .select('member_id')
        .like('member_id', 'UDAAN-0%')
        .neq('member_id', 'UDAAN-000') // Exclude super admin
        .order('member_id', { ascending: false });

      if (fetchCouncilError) {
        console.error('Error fetching council members:', fetchCouncilError);
        lastError = fetchCouncilError;
        continue; // Retry
      }

      let nextNum = 1;
      if (existingCouncil && existingCouncil.length > 0) {
        // FIX: Robust number extraction - only consider 0XX format (council IDs)
        const numbers = existingCouncil.map(m => {
          const match = m.member_id.match(/^UDAAN-0(\d{2})$/);
          return match ? parseInt(match[1], 10) : 0;
        }).filter(n => n > 0 && n < 100);

        if (numbers.length > 0) {
          nextNum = Math.max(...numbers) + 1;
        }
      }

      // FIX: Add attempt offset to avoid collision on retry
      memberId = `UDAAN-${String(nextNum + attempt).padStart(3, '0')}`;
    } else {
      // Non-council members use UDAAN-{year}XXX format
      const yearPrefix = `UDAAN-${member.year}`;

      // Get existing members with this year prefix
      const { data: existingMembers, error: fetchError } = await supabase
        .from('members')
        .select('member_id')
        .like('member_id', `${yearPrefix}%`)
        .order('member_id', { ascending: false });

      if (fetchError) {
        console.error('Error fetching existing members:', fetchError);
        lastError = fetchError;
        continue; // Retry
      }

      // FIX: Calculate next number with robust parsing
      let nextNumber = 1;
      if (existingMembers && existingMembers.length > 0) {
        // Extract numbers from existing IDs (e.g., UDAAN-2001 -> 001)
        const numbers = existingMembers.map(m => {
          // FIX: Use regex for more robust extraction
          const match = m.member_id.match(new RegExp(`^${yearPrefix}(\\d+)$`));
          return match ? parseInt(match[1], 10) : 0;
        }).filter(n => !isNaN(n) && n > 0);

        if (numbers.length > 0) {
          nextNumber = Math.max(...numbers) + 1;
        }
      }

      // FIX: Add attempt offset to avoid collision on retry
      memberId = `${yearPrefix}${String(nextNumber + attempt).padStart(3, '0')}`;
    }

    // Insert new member - allow caller to set initial status (default to 'approved')
    const insertStatus = member.status || 'approved';
    const { data, error } = await supabase
      .from('members')
      .insert([{
        member_id: memberId,
        name: member.name,
        email: member.email,
        password: member.password,
        role: member.role,
        division: member.division,
        clearance: clearance,
        year: member.year,
        status: insertStatus,
        added_by: member.added_by,
        roll_no: member.roll_no || null,
        department: member.department || null,
        institute_email: member.institute_email || null
      }])
      .select()
      .single();

    if (error) {
      // FIX: Check if it's a duplicate key error - if so, retry with next ID
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        console.warn(`ID collision detected for ${memberId}, retrying with next ID...`);
        lastError = error;
        continue; // Retry with next ID
      }
      console.error('Error adding member:', error);
      lastError = error;
      continue; // Retry
    }

    // SUCCESS - Division tables are synced automatically by the database trigger (trg_sync_divisions)
    // No need to manually call addMemberToAllDivisionTables - the trigger handles it on INSERT

    return { success: true, member: data as Member };
  }

  // All retries failed
  console.error(`Failed to add member after ${maxRetries} attempts. Last error:`, lastError);
  const errorMessage = lastError?.message || lastError?.details || 'Unknown error occurred';
  return { success: false, error: `Failed after ${maxRetries} attempts: ${errorMessage}` };
}

/**
 * Remove a member (simple delete)
 * Cannot delete UDAAN-000 super admin
 */
export async function removeMember(memberId: string): Promise<boolean> {
  // Protect the super admin from deletion
  if (isSuperAdmin(memberId)) {
    console.error('Cannot delete UDAAN-000 super admin account');
    return false;
  }

  // First remove from all division tables
  await removeMemberFromAllDivisionTables(memberId);

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('member_id', memberId);

  if (error) {
    console.error('Error removing member:', error);
    return false;
  }

  return true;
}

/**
 * Remove a member and all related data (tasks, notifications, activity logs)
 * This is a complete cleanup function
 * Cannot delete UDAAN-000 super admin
 */
export async function removeMemberCompletely(memberId: string): Promise<{ success: boolean; message: string }> {
  // Protect the super admin from deletion
  if (isSuperAdmin(memberId)) {
    return { success: false, message: 'Cannot delete UDAAN-000 super admin account' };
  }

  try {
    // Get member name first for cleaning up notifications that mention them
    const { data: memberData } = await supabase
      .from('members')
      .select('name')
      .eq('member_id', memberId)
      .single();

    const memberName = memberData?.name || '';

    // 0. Remove from all division tables first
    await removeMemberFromAllDivisionTables(memberId);

    // 1. Delete all tasks assigned TO this member
    const { error: tasksToError } = await supabase
      .from('tasks')
      .delete()
      .eq('assigned_to', memberId);

    if (tasksToError) {
      console.error('Error deleting tasks assigned to member:', tasksToError);
    }

    // 2. Delete all tasks assigned BY this member
    const { error: tasksByError } = await supabase
      .from('tasks')
      .delete()
      .eq('assigned_by', memberId);

    if (tasksByError) {
      console.error('Error deleting tasks assigned by member:', tasksByError);
    }

    // 3. Delete all notifications FOR this member
    const { error: notifError } = await supabase
      .from('notifications')
      .delete()
      .eq('member_id', memberId);

    if (notifError) {
      console.error('Error deleting notifications for member:', notifError);
    }

    // 3b. Delete all notifications ABOUT this member (mentions in message/title)
    if (memberName) {
      await supabase
        .from('notifications')
        .delete()
        .or(`message.ilike.%${memberName}%,title.ilike.%${memberName}%`);
    }

    // 3c. Delete notifications mentioning this member_id
    await supabase
      .from('notifications')
      .delete()
      .or(`message.ilike.%${memberId}%,title.ilike.%${memberId}%`);

    // 4. Delete all activity logs for this member
    const { error: activityError } = await supabase
      .from('activity_logs')
      .delete()
      .eq('member_id', memberId);

    if (activityError) {
      console.error('Error deleting activity logs:', activityError);
    }

    // 5. Delete announcements created by this member (and their notifications)
    const { data: memberAnnouncements } = await supabase
      .from('announcements')
      .select('id')
      .eq('created_by', memberId);

    if (memberAnnouncements && memberAnnouncements.length > 0) {
      // Delete notifications for each announcement
      for (const ann of memberAnnouncements) {
        await supabase
          .from('notifications')
          .delete()
          .eq('announcement_id', ann.id);
      }
    }

    const { error: announcementError } = await supabase
      .from('announcements')
      .delete()
      .eq('created_by', memberId);

    if (announcementError) {
      console.error('Error deleting announcements:', announcementError);
    }

    // 6. Delete division requests by this member
    await supabase
      .from('division_requests')
      .delete()
      .eq('member_id', memberId);

    // 7. Finally, delete the member
    const { error: memberError } = await supabase
      .from('members')
      .delete()
      .eq('member_id', memberId);

    if (memberError) {
      console.error('Error deleting member:', memberError);
      return { success: false, message: 'Failed to delete member' };
    }

    return { success: true, message: 'Member and all related data deleted successfully' };
  } catch (error) {
    console.error('Error in removeMemberCompletely:', error);
    return { success: false, message: 'An error occurred while deleting member' };
  }
}

/**
 * Get registration count for an event
 */
export async function getEventRegistrationCount(eventId: string): Promise<number> {
  const { count, error } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (error) {
    console.error('Error fetching registration count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Get all registration counts
 */
export async function getAllRegistrationCounts(): Promise<{ [key: string]: number }> {
  const events = ['aeroprix', 'hovermania', 'aviation-sim'];
  const counts: { [key: string]: number } = {};

  for (const event of events) {
    counts[event] = await getEventRegistrationCount(event);
  }

  return counts;
}

/**
 * Get all registrations for an event (for team members)
 */
export async function getEventRegistrations(eventId: string): Promise<Registration[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', eventId)
    .order('registered_at', { ascending: false });

  if (error) {
    console.error('Error fetching registrations:', error);
    return [];
  }

  return data as Registration[];
}

/**
 * Register a team for an event
 */
export async function registerForEvent(registration: {
  event_id: string;
  team_name: string;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  leader_college: string;
  leader_branch?: string;
  leader_year?: string;
  members?: Array<{ name: string; email: string; phone: string; college: string }>;
}): Promise<Registration | null> {
  const { data, error } = await supabase
    .from('registrations')
    .insert([{
      ...registration,
      members: registration.members || []
    }])
    .select()
    .single();

  if (error) {
    console.error('Error registering for event:', error);
    return null;
  }

  return data as Registration;
}

/**
 * Get app config
 */
export async function getConfig(): Promise<Config | null> {
  const { data, error } = await supabase
    .from('config')
    .select('*')
    .single();

  if (error) {
    console.error('Error fetching config:', error);
    return null;
  }

  return data as Config;
}

/**
 * Update app config
 */
export async function updateConfig(config: { induction_open?: boolean; registration_open?: boolean }): Promise<boolean> {
  const { error } = await supabase
    .from('config')
    .update({
      ...config,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);

  if (error) {
    console.error('Error updating config:', error);
    return false;
  }

  return true;
}

// ============ TASK FUNCTIONS ============

/**
 * Create a new task assignment
 */
export async function createTask(task: {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  due_date: string;
  assigned_to: string;
  assigned_by: string;
  assigned_by_name: string;
}): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      ...task,
      status: 'pending'
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
    return null;
  }

  return data as Task;
}

/**
 * Get tasks assigned to a specific member
 */
export async function getTasksForMember(memberId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', memberId)
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }

  return data as Task[];
}

/**
 * Get tasks for a member based on their role
 * - Super Admin: Sees all tasks for all members
 * - Regular Members: See their assigned tasks only
 * - Alumni: Cannot be assigned tasks (returns empty)
 */
export async function getTasksForMemberByRole(memberId: string, year: number, clearance: number, role: string): Promise<Task[]> {
  try {
    if (isSuperAdmin(memberId)) {
      // Super admin sees all tasks
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Error fetching all tasks:', error);
        return [];
      }
      return data as Task[];
    }

    if (year === 0 && role === 'Alumni') {
      // Alumni cannot have tasks assigned
      return [];
    }

    // Regular members see their own tasks
    return await getTasksForMember(memberId);
  } catch (error) {
    console.error('Error in getTasksForMemberByRole:', error);
    return [];
  }
}


/**
 * Get tasks assigned by a specific council member
 */
export async function getTasksAssignedBy(memberId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_by', memberId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching assigned tasks:', error);
    return [];
  }

  return data as Task[];
}

/**
 * Update task status
 */
export async function updateTaskStatus(taskId: string, status: 'pending' | 'in-progress' | 'completed'): Promise<boolean> {
  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId);

  if (error) {
    console.error('Error updating task status:', error);
    return false;
  }

  return true;
}

/**
 * Delete a task and its related notifications
 */
export async function deleteTask(taskId: string): Promise<boolean> {
  // Delete all notifications related to this task using the utility function
  await deleteRelatedNotifications('task', taskId);

  // Now delete the task
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('Error deleting task:', error);
    return false;
  }

  return true;
}

/**
 * Get all tasks for a member (both assigned by others and self-created)
 */
export async function getAllTasksForMember(memberId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', memberId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all tasks:', error);
    return [];
  }

  return data as Task[];
}

/**
 * Create a self-assigned task
 */
export async function createSelfTask(task: {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  due_date: string;
  member_id: string;
  member_name: string;
}): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      category: task.category,
      due_date: task.due_date,
      assigned_to: task.member_id,
      assigned_by: task.member_id,  // Use member's own ID for self-assigned
      assigned_by_name: 'Self',
      status: 'pending'
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating self task:', error);
    return null;
  }

  return data as Task;
}

// ============ ANNOUNCEMENT FUNCTIONS ============

/**
 * Get all announcements
 */
export async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }

  return data as Announcement[];
}

/**
 * Get announcements for a specific member based on their role
 * - Super Admin (UDAAN-000): All announcements
 * - Regular Members: All announcements from any creator
 * - Alumni: Only announcements created by UDAAN-000 (admin announcements)
 */
export async function getAnnouncementsForMember(memberId: string, memberRole: string): Promise<Announcement[]> {
  try {
    if (isSuperAdmin(memberId)) {
      // Super admin sees ALL announcements
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching announcements:', error);
        return [];
      }
      return data as Announcement[];
    }

    if (memberRole === 'Alumni') {
      // Alumni see ONLY announcements created by UDAAN-000
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('created_by', 'UDAAN-000')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admin announcements:', error);
        return [];
      }
      return data as Announcement[];
    }

    // Regular members see all announcements
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
      return [];
    }

    return data as Announcement[];
  } catch (error) {
    console.error('Error in getAnnouncementsForMember:', error);
    return [];
  }
}

/**
 * Create a new announcement (council only)
 */
export async function createAnnouncement(announcement: {
  title: string;
  content: string;
  type: 'meeting' | 'update' | 'deadline' | 'important';
  date: string;
  created_by: string;
  created_by_name: string;
}): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from('announcements')
    .insert([announcement])
    .select()
    .single();

  if (error) {
    console.error('Error creating announcement:', error);
    return null;
  }

  return data as Announcement;
}

/**
 * Delete an announcement and its related notifications
 */
export async function deleteAnnouncement(announcementId: string): Promise<boolean> {
  // Delete notifications by announcement_id (direct reference)
  const { error: notifError1 } = await supabase
    .from('notifications')
    .delete()
    .eq('announcement_id', announcementId);

  if (notifError1) {
    console.error('Error deleting notifications by announcement_id:', notifError1);
  }

  // Also delete by type + matching patterns (for older notifications)
  await supabase
    .from('notifications')
    .delete()
    .eq('type', 'announcement')
    .or(`link.ilike.%${announcementId}%,message.ilike.%${announcementId}%`);

  // Now delete the announcement
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId);

  if (error) {
    console.error('Error deleting announcement:', error);
    return false;
  }

  return true;
}

/**
 * Update an announcement
 */
export async function updateAnnouncement(announcementId: string, updates: {
  title?: string;
  content?: string;
  type?: 'meeting' | 'update' | 'deadline' | 'important';
  date?: string;
}): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from('announcements')
    .update(updates)
    .eq('id', announcementId)
    .select()
    .single();

  if (error) {
    console.error('Error updating announcement:', error);
    return null;
  }

  return data as Announcement;
}

// ============ UPDATE TASK DETAILS ============

/**
 * Update task details (title, description, due date, priority, category)
 */
export async function updateTaskDetails(taskId: string, updates: {
  title?: string;
  description?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  status?: 'pending' | 'in-progress' | 'completed';
}): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error updating task details:', error);
    return null;
  }

  return data as Task;
}

// ============ MEMBER PROFILE FUNCTIONS ============

/**
 * Update member profile (password, role, etc.)
 */
export async function updateMemberProfile(memberId: string, updates: {
  password?: string;
  email?: string;
  personal_email?: string;
  institute_email?: string;
  roll_no?: string;
  phone?: string;
  department?: string;
  role?: string;
  division?: string;
}): Promise<Member | null> {
  const { data, error } = await supabase
    .from('members')
    .update(updates)
    .eq('member_id', memberId)
    .select()
    .single();

  if (error) {
    console.error('Error updating member profile:', error);
    return null;
  }

  return data as Member;
}

/**
 * Toggle member inactive status
 * Only council members (clearance 5) and UDAAN-000 can toggle inactive status
 * @param memberId - The member to toggle
 * @param actorMemberId - The member performing the action (must be council or UDAAN-000)
 * @returns Updated member or null if failed
 */
export async function toggleMemberInactiveStatus(memberId: string, actorMemberId: string): Promise<{ success: boolean; member?: Member; message: string }> {
  // Check if actor is authorized (council or super admin)
  const { data: actor, error: actorError } = await supabase
    .from('members')
    .select('clearance, member_id')
    .eq('member_id', actorMemberId)
    .single();

  if (actorError || !actor) {
    return { success: false, message: 'Unable to verify permissions' };
  }

  const isAuthorized = actor.clearance === 5 || isSuperAdmin(actorMemberId);
  if (!isAuthorized) {
    return { success: false, message: 'Only council members can toggle inactive status' };
  }

  // Get current member status (only fetch needed fields)
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('member_id, name, is_inactive')
    .eq('member_id', memberId)
    .single();

  if (memberError || !member) {
    return { success: false, message: 'Member not found' };
  }

  // Toggle the status
  const newIsInactive = !member.is_inactive;
  const newInactiveSince = newIsInactive ? new Date().toISOString() : null;

  const { data: updated, error: updateError } = await supabase
    .from('members')
    .update({
      is_inactive: newIsInactive,
      inactive_since: newInactiveSince
    })
    .eq('member_id', memberId)
    .select()
    .single();

  if (updateError) {
    console.error('Error toggling inactive status:', updateError);
    // Check if the error is due to missing columns
    if (updateError.message?.includes('is_inactive') || updateError.message?.includes('inactive_since') || updateError.code === '42703') {
      return { success: false, message: 'Database columns missing. Please run the migration: db/migration_inactive_status.sql' };
    }
    return { success: false, message: `Failed to update status: ${updateError.message}` };
  }

  return {
    success: true,
    member: updated as Member,
    message: newIsInactive ? 'Member marked as inactive' : 'Member marked as active'
  };
}

/**
 * Generate a 6-digit verification code
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification code to personal email using EmailJS
 * Stores the code in the database with 15-minute expiry
 * 
 * EmailJS Setup Required:
 * 1. Go to https://www.emailjs.com/ and create a free account
 * 2. Add an email service (Gmail, Outlook, etc.)
 * 3. Create an email template with variables: {{to_email}}, {{verification_code}}, {{member_name}}
 * 4. Get your Service ID, Template ID, and Public Key
 * 5. Update the constants below
 */

// EmailJS Configuration - UPDATE THESE WITH YOUR CREDENTIALS
const EMAILJS_SERVICE_ID = 'service_3umuu5r'; // Replace with your EmailJS service ID
const EMAILJS_TEMPLATE_ID = 'template_7o4eowq'; // Replace with your EmailJS template ID  
const EMAILJS_PUBLIC_KEY = 'e-K6XXy5MBWit0-js'; // Replace with your EmailJS public key

export async function sendEmailVerificationCode(memberId: string, email: string, memberName?: string): Promise<{ success: boolean; message: string; code?: string }> {
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes from now

  // Store the verification code in database
  const { error } = await supabase
    .from('members')
    .update({
      email_verification_code: code,
      email_verification_expires: expiresAt,
      personal_email: email // Update the email being verified
    })
    .eq('member_id', memberId);

  if (error) {
    console.error('Error storing verification code:', error);
    return { success: false, message: 'Failed to generate verification code' };
  }

  // Send email via Custom Email Service
  try {
    const { sendVerificationEmail } = await import('./email');
    const emailSuccess = await sendVerificationEmail(email, memberName || 'Team Member', code);

    if (emailSuccess) {
      return {
        success: true,
        message: `Verification code sent to ${email}. Check your inbox (and spam folder). Code expires in 15 minutes.`
      };
    } else {
      // Email failed - do not expose the code, return error
      return {
        success: false,
        message: 'Unable to send verification email. Please try again or contact support.'
      };
    }
  } catch {
    // Email exception - do not expose the code, return error
    return {
      success: false,
      message: 'Unable to send verification email. Please try again later.'
    };
  }
}

/**
 * Verify the email with the provided code
 */
export async function verifyEmailCode(memberId: string, code: string): Promise<{ success: boolean; message: string }> {
  // Get the stored verification code
  const { data: member, error: fetchError } = await supabase
    .from('members')
    .select('email_verification_code, email_verification_expires, personal_email')
    .eq('member_id', memberId)
    .single();

  if (fetchError || !member) {
    return { success: false, message: 'Member not found' };
  }

  if (!member.email_verification_code) {
    return { success: false, message: 'No verification code found. Please request a new code.' };
  }

  // Check if code has expired
  if (member.email_verification_expires) {
    const expiresAt = new Date(member.email_verification_expires);
    if (new Date() > expiresAt) {
      // Clear expired code
      await supabase
        .from('members')
        .update({ email_verification_code: null, email_verification_expires: null })
        .eq('member_id', memberId);
      return { success: false, message: 'Verification code has expired. Please request a new code.' };
    }
  }

  // Check if code matches
  if (member.email_verification_code !== code) {
    return { success: false, message: 'Invalid verification code. Please try again.' };
  }

  // Code is valid - mark email as verified and clear the code
  const { error: updateError } = await supabase
    .from('members')
    .update({
      email_verified: true,
      email_verification_code: null,
      email_verification_expires: null
    })
    .eq('member_id', memberId);

  if (updateError) {
    console.error('Error verifying email:', updateError);
    return { success: false, message: 'Failed to verify email. Please try again.' };
  }

  return { success: true, message: 'Email verified successfully!' };
}

/**
 * Reset email verification status (when email is changed)
 */
export async function resetEmailVerification(memberId: string): Promise<boolean> {
  const { error } = await supabase
    .from('members')
    .update({
      email_verified: false,
      email_verification_code: null,
      email_verification_expires: null
    })
    .eq('member_id', memberId);

  return !error;
}

/**
 * Get email verification status
 */
export async function getEmailVerificationStatus(memberId: string): Promise<{ verified: boolean; email?: string }> {
  const { data, error } = await supabase
    .from('members')
    .select('email_verified, personal_email')
    .eq('member_id', memberId)
    .single();

  if (error || !data) {
    return { verified: false };
  }

  return {
    verified: data.email_verified || false,
    email: data.personal_email
  };
}

// ============================================================================
// COUNCIL TRANSFER ID CHANGE NOTIFICATION EMAIL
// ============================================================================

/**
 * EmailJS Template ID for ID Change Notification
 * This template should have variables:
 * - {{to_email}}: Recipient email
 * - {{member_name}}: Member's name
 * - {{old_id}}: Previous member ID
 * - {{new_id}}: New member ID
 * - {{timestamp}}: When the change occurred
 * 
 * Template should include:
 * - Clear notice that Member ID has changed
 * - Old ID and New ID
 * - Confirmation that password remains the same
 * - Reassurance that no action is required
 */
const EMAILJS_ID_CHANGE_TEMPLATE_ID = 'template_id_change'; // Create this template in EmailJS

/**
 * Send ID Change Notification Email to a single member
 * ONLY sends to verified personal email addresses
 * 
 * @param memberName - Member's display name
 * @param oldId - Previous member ID (before transfer)
 * @param newId - New member ID (after transfer)
 * @param verifiedEmail - Member's verified personal email (NOT derived institute email)
 * @returns Promise<boolean> - True if email sent successfully
 */
async function sendIdChangeNotificationEmail(
  memberName: string,
  oldId: string,
  newId: string,
  verifiedEmail: string
): Promise<boolean> {
  const { sendIdChangeNotificationEmail } = await import('./email');
  return sendIdChangeNotificationEmail(memberName, oldId, newId, verifiedEmail);
}

/**
 * Interface for ID change notification result
 */
interface IdChangeNotificationResult {
  memberId: string;
  memberName: string;
  oldId: string;
  newId: string;
  email: string | null;
  sent: boolean;
  reason?: string;
}

/**
 * Send ID Change Notifications to all affected members after council transfer
 * 
 * RULES:
 * - Only sends to VERIFIED personal emails (not derived institute emails)
 * - Excludes Alumni (year === 0 or ID starts with 'A-')
 * - Excludes UDAAN-000 (super admin)
 * - Only sends to members whose ID actually changed
 * - Logs all send attempts for admin visibility
 * 
 * @param migrations - Array of migration records from council transfer
 * @returns Array of notification results for admin visibility
 */
export async function sendIdChangeNotifications(
  migrations: Array<{
    oldId: string;
    newId?: string;
    oldRole: string;
    newRole: string;
  }>
): Promise<IdChangeNotificationResult[]> {
  const results: IdChangeNotificationResult[] = [];

  // Filter migrations to only those with ID changes (excluding UDAAN-000 and Alumni)
  const eligibleMigrations = migrations.filter(m => {
    // Must have a new ID different from old ID
    if (!m.newId || m.newId === m.oldId) return false;
    // Exclude UDAAN-000
    if (m.oldId === 'UDAAN-000') return false;
    // Exclude Alumni (new role is Alumni or new ID starts with A-)
    if (m.newRole === 'Alumni' || m.newId.startsWith('A-')) return false;
    return true;
  });

  // Process each eligible member
  for (const migration of eligibleMigrations) {
    const result: IdChangeNotificationResult = {
      memberId: migration.newId!,
      memberName: '',
      oldId: migration.oldId,
      newId: migration.newId!,
      email: null,
      sent: false
    };

    try {
      // Fetch member's verified email from database using NEW ID (after migration)
      const { data: member, error } = await supabase
        .from('members')
        .select('name, personal_email, email_verified')
        .eq('member_id', migration.newId)
        .single();

      if (error || !member) {
        result.reason = 'Member not found after migration';
        results.push(result);
        continue;
      }

      result.memberName = member.name || 'Unknown';

      // Check if email is verified
      if (!member.email_verified) {
        result.reason = 'Email not verified';
        results.push(result);
        continue;
      }

      // Check if personal email exists
      if (!member.personal_email) {
        result.reason = 'No personal email on file';
        results.push(result);
        continue;
      }

      result.email = member.personal_email;

      // Send the notification email
      const sent = await sendIdChangeNotificationEmail(
        member.name,
        migration.oldId,
        migration.newId!,
        member.personal_email
      );

      result.sent = sent;
      if (!sent) {
        result.reason = 'Email send failed';
      }
    } catch (err) {
      result.reason = 'Error processing notification';
    }

    results.push(result);
  }

  // Log summary for admin visibility (in activity log)
  const sentCount = results.filter(r => r.sent).length;
  const skippedCount = results.filter(r => !r.sent).length;

  if (results.length > 0) {
    await logActivity({
      member_id: 'UDAAN-000',
      member_name: 'UDAAN Administration',
      action: 'id_change_notifications',
      details: `ID Change emails: ${sentCount} sent, ${skippedCount} skipped. Skipped reasons: ${results.filter(r => !r.sent).map(r => `${r.oldId}: ${r.reason}`).join('; ') || 'None'
        }`,
      target_type: 'system',
      target_id: 'email_notifications'
    });
  }

  return results;
}

// Phone verification DB helpers removed — phone OTP verification has been removed from the app

/**
 * Change member password
 * Prevents reusing any of the last 5 passwords
 */
export async function changeMemberPassword(memberId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  const { data: member, error: fetchError } = await supabase
    .from('members')
    .select('password')
    .eq('member_id', memberId.toUpperCase())
    .single();

  if (fetchError || !member) {
    console.error('Password change - fetch error:', fetchError);
    return { success: false, message: 'Failed to verify user. Please try again.' };
  }

  const storedPass = member.password || '';
  const trimmedCurrent = currentPassword.trim();
  const trimmedNew = newPassword.trim();

  // 1. Verify current password
  try {
    if (storedPass.startsWith('$2')) {
      // Hashed password
      const match = await bcrypt.compare(trimmedCurrent, storedPass);
      if (!match) return { success: false, message: 'Current password is incorrect' };
    } else {
      // Plaintext fallback (pre-migration)
      if (storedPass !== trimmedCurrent) {
        return { success: false, message: 'Current password is incorrect' };
      }
    }
  } catch (err) {
    return { success: false, message: 'Verification error. Please try again.' };
  }

  // 2. Prevent same password
  if (trimmedNew === trimmedCurrent) {
    return { success: false, message: 'New password cannot be the same as your current password' };
  }

  // 3. Hash new password and update
  try {
    const hashedNewPassword = await bcrypt.hash(trimmedNew, 10);
    const { error: updateError } = await supabase
      .from('members')
      .update({ password: hashedNewPassword })
      .eq('member_id', memberId.toUpperCase());

    if (updateError) {
      console.error('Password update error:', updateError);
      return { success: false, message: 'Failed to update password' };
    }
  } catch (err) {
    return { success: false, message: 'Encryption error. Please try again.' };
  }

  return { success: true, message: 'Password changed successfully' };
}

// ============ ACTIVITY LOGS ============

export interface ActivityLog {
  id: string;
  member_id: string;
  member_name: string;
  action: string; // 'task_created' | 'task_completed' | 'announcement_created' | 'member_added' | 'login' | etc.
  details: string; // JSON or text description of what happened
  target_type?: string; // 'task' | 'announcement' | 'member' | null
  target_id?: string;
  created_at: string;
}

/**
 * Log an activity
 */
export async function logActivity(activity: {
  member_id: string;
  member_name: string;
  action: string;
  details: string;
  target_type?: string;
  target_id?: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from('activity_logs')
    .insert([activity]);

  if (error) {
    console.error('Error logging activity:', error);
    return false;
  }

  return true;
}

/**
 * Get activity logs (optionally filtered by member)
 */
export async function getActivityLogs(memberId?: string, limit: number = 50): Promise<ActivityLog[]> {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (memberId) {
    query = query.eq('member_id', memberId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching activity logs:', error);
    return [];
  }

  return data as ActivityLog[];
}

/**
 * Get recent activity for dashboard
 */
export async function getRecentActivity(limit: number = 10): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent activity:', error);
    return [];
  }

  return data as ActivityLog[];
}

// ============ NOTIFICATIONS ============

export interface Notification {
  id: string;
  member_id: string; // recipient
  type: 'task_assigned' | 'task_updated' | 'announcement' | 'mention' | 'reminder' | 'system';
  title: string;
  message: string;
  read: boolean;
  link?: string; // optional link to navigate to
  created_at: string;
  // Announcement metadata (optional, only for announcement notifications)
  announcement_id?: string; // uuid reference to announcements table
  event_date?: string;
  announcement_type?: string;
}

/**
 * Create a notification for a member
 */
export async function createNotification(notification: {
  member_id: string;
  type: 'task_assigned' | 'task_updated' | 'announcement' | 'mention' | 'reminder' | 'system';
  title: string;
  message: string;
  link?: string;
}): Promise<Notification | null> {
  const { data, error } = await supabase
    .from('notifications')
    .insert([{
      ...notification,
      read: false
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return null;
  }

  return data as Notification;
}

/**
 * Create notifications for multiple members (e.g., broadcast announcement)
 */
export async function createBulkNotifications(notifications: Array<{
  member_id: string;
  type: 'task_assigned' | 'task_updated' | 'announcement' | 'mention' | 'reminder' | 'system';
  title: string;
  message: string;
  link?: string;
  // Optional announcement metadata
  announcement_id?: string; // uuid reference
  event_date?: string;
  announcement_type?: string;
}>): Promise<boolean> {
  const notificationsWithRead = notifications.map(n => ({ ...n, read: false }));

  const { error } = await supabase
    .from('notifications')
    .insert(notificationsWithRead);

  if (error) {
    console.error('Error creating bulk notifications:', error);
    return false;
  }

  return true;
}

/**
 * Get notifications for a member
 */
export async function getNotifications(memberId: string, unreadOnly: boolean = false): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data as Notification[];
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(memberId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('read', false);

  if (error) {
    console.error('Error fetching notification count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }

  return true;
}

/**
 * Mark all notifications as read for a member
 */
export async function markAllNotificationsAsRead(memberId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('member_id', memberId)
    .eq('read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }

  return true;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Error deleting notification:', error);
    return false;
  }

  return true;
}

/**
 * Delete old notifications (cleanup - older than specified days)
 */
export async function deleteOldNotifications(daysOld: number = 30): Promise<boolean> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const { error } = await supabase
    .from('notifications')
    .delete()
    .lt('created_at', cutoffDate.toISOString());

  if (error) {
    console.error('Error deleting old notifications:', error);
    return false;
  }

  return true;
}

/**
 * Delete notifications related to a specific item (task, announcement, etc.)
 * Searches in link and message fields
 */
export async function deleteRelatedNotifications(itemType: string, itemId: string | number): Promise<boolean> {
  try {
    // Delete notifications with matching link
    await supabase
      .from('notifications')
      .delete()
      .ilike('link', `%${itemType}%${itemId}%`);

    // Delete notifications with matching message content
    await supabase
      .from('notifications')
      .delete()
      .or(`message.ilike.%${itemType}%${itemId}%,title.ilike.%${itemType}%${itemId}%`);

    return true;
  } catch (error) {
    console.error('Error deleting related notifications:', error);
    return false;
  }
}

// ============ ADDITIONAL UTILITY FUNCTIONS ============

/**
 * Get a single member by member_id
 * SECURITY: Returns limited fields - use for display purposes only
 */
export async function getMemberById(memberId: string): Promise<Member | null> {
  const { data, error } = await supabase
    .from('public_team_members')  // Use secure view
    .select('member_id, name, role, division, year, department, profile_pic, clearance')
    .eq('member_id', memberId)
    .single();

  if (error) {
    return null;
  }

  return data as Member;
}

/**
 * Search members by name or email
 * SECURITY: Uses secure view for public-safe results
 */
export async function searchMembers(query: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('public_team_members')  // Use secure view
    .select('member_id, name, role, division, year, department, profile_pic, clearance')
    .or(`name.ilike.%${query}%`)  // Note: email not available in public view
    .order('name', { ascending: true });

  if (error) {
    return [];
  }

  return data as Member[];
}

/**
 * Get task statistics for dashboard
 */
export async function getTaskStats(memberId?: string): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}> {
  let query = supabase.from('tasks').select('status, due_date');

  if (memberId) {
    query = query.eq('assigned_to', memberId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching task stats:', error);
    return { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0 };
  }

  const now = new Date().toISOString().split('T')[0];

  return {
    total: data.length,
    pending: data.filter(t => t.status === 'pending').length,
    inProgress: data.filter(t => t.status === 'in-progress').length,
    completed: data.filter(t => t.status === 'completed').length,
    overdue: data.filter(t => t.status !== 'completed' && t.due_date < now).length
  };
}

/**
 * Get announcements within a date range
 */
export async function getAnnouncementsByDateRange(startDate: string, endDate: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching announcements by date:', error);
    return [];
  }

  return data as Announcement[];
}

/**
 * Update member role (admin function)
 */
export async function updateMemberRole(memberId: string, newRole: string, newClearance?: number): Promise<boolean> {
  const updates: { role: string; clearance?: number } = { role: newRole };
  if (newClearance !== undefined) {
    updates.clearance = newClearance;
  }

  const { error } = await supabase
    .from('members')
    .update(updates)
    .eq('member_id', memberId);

  if (error) {
    console.error('Error updating member role:', error);
    return false;
  }

  return true;
}

/**
 * Get task completion stats for a member (for profile/analytics)
 */
export async function getMemberTaskStats(memberId: string): Promise<{
  tasksAssigned: number;
  tasksCompleted: number;
  tasksAssignedToOthers: number;
  completionRate: number;
}> {
  // Tasks assigned to this member
  const { data: assignedToMe, error: err1 } = await supabase
    .from('tasks')
    .select('status')
    .eq('assigned_to', memberId);

  // Tasks this member assigned to others
  const { data: assignedByMe, error: err2 } = await supabase
    .from('tasks')
    .select('id')
    .eq('assigned_by', memberId)
    .neq('assigned_to', memberId); // Exclude self-assigned

  if (err1 || err2) {
    console.error('Error fetching member task stats:', err1 || err2);
    return { tasksAssigned: 0, tasksCompleted: 0, tasksAssignedToOthers: 0, completionRate: 0 };
  }

  const tasksAssigned = assignedToMe?.length || 0;
  const tasksCompleted = assignedToMe?.filter(t => t.status === 'completed').length || 0;
  const tasksAssignedToOthers = assignedByMe?.length || 0;
  const completionRate = tasksAssigned > 0 ? Math.round((tasksCompleted / tasksAssigned) * 100) : 0;

  return {
    tasksAssigned,
    tasksCompleted,
    tasksAssignedToOthers,
    completionRate
  };
}

/**
 * Get upcoming deadlines (tasks and announcements with deadlines)
 */
export async function getUpcomingDeadlines(memberId: string, daysAhead: number = 7): Promise<{
  tasks: Task[];
  announcements: Announcement[];
}> {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const future = futureDate.toISOString().split('T')[0];

  // Get upcoming tasks
  const { data: tasks, error: taskErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', memberId)
    .neq('status', 'completed')
    .gte('due_date', today)
    .lte('due_date', future)
    .order('due_date', { ascending: true });

  // Get upcoming deadline announcements
  const { data: announcements, error: annErr } = await supabase
    .from('announcements')
    .select('*')
    .eq('type', 'deadline')
    .gte('date', today)
    .lte('date', future)
    .order('date', { ascending: true });

  if (taskErr || annErr) {
    console.error('Error fetching upcoming deadlines:', taskErr || annErr);
    return { tasks: [], announcements: [] };
  }

  return {
    tasks: tasks as Task[],
    announcements: announcements as Announcement[]
  };
}

/**
 * Get overdue tasks for a member
 */
export async function getOverdueTasks(memberId: string): Promise<Task[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', memberId)
    .neq('status', 'completed')
    .lt('due_date', today)
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching overdue tasks:', error);
    return [];
  }

  return data as Task[];
}

/**
 * Bulk update task statuses (for batch operations)
 */
export async function bulkUpdateTaskStatus(taskIds: string[], status: 'pending' | 'in-progress' | 'completed'): Promise<boolean> {
  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .in('id', taskIds);

  if (error) {
    console.error('Error bulk updating tasks:', error);
    return false;
  }

  return true;
}

/**
 * Get division statistics
 */
export async function getDivisionStats(): Promise<{
  [division: string]: {
    memberCount: number;
    taskCount: number;
    completedTasks: number;
  }
}> {
  const { data: members, error: memErr } = await supabase
    .from('members')
    .select('division')
    .eq('status', 'approved');

  const { data: tasks, error: taskErr } = await supabase
    .from('tasks')
    .select('assigned_to, status');

  if (memErr || taskErr) {
    console.error('Error fetching division stats:', memErr || taskErr);
    return {};
  }

  const stats: { [division: string]: { memberCount: number; taskCount: number; completedTasks: number } } = {};

  // Count members per division
  members?.forEach(m => {
    if (!stats[m.division]) {
      stats[m.division] = { memberCount: 0, taskCount: 0, completedTasks: 0 };
    }
    stats[m.division].memberCount++;
  });

  return stats;
}

// ============ APPLICANT FUNCTIONS (Join Corps) ============

/**
 * Submit a new applicant (Join Corps form)
 */
export async function submitApplicant(applicant: {
  name: string;
  email: string;
  phone: string;
  roll_no: string;
  department: string;
  year: string;
  interests: string[];
  experience: string;
  why_join: string;
  email_verified?: boolean;
}): Promise<Applicant | null> {
  const { data, error } = await supabase
    .from('applicants')
    .insert([{
      ...applicant,
      status: 'pending'
    }])
    .select()
    .single();

  if (error) {
    console.error('Error submitting applicant:', error);
    return null;
  }

  return data as Applicant;
}

/**
 * Check if an applicant already exists (by email or roll number)
 */
export async function checkExistingApplicant(email: string, rollNo: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('applicants')
    .select('id')
    .or(`email.eq.${email},roll_no.eq.${rollNo}`)
    .limit(1);

  if (error) {
    console.error('Error checking existing applicant:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Get all applicants (for admin review)
 */
export async function getApplicants(status?: 'pending' | 'approved' | 'rejected'): Promise<Applicant[]> {
  let query = supabase
    .from('applicants')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching applicants:', error);
    return [];
  }

  return data as Applicant[];
}

/**
 * Get pending applicants count
 */
export async function getPendingApplicantsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('applicants')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    console.error('Error fetching pending applicants count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Update applicant status (approve/reject)
 */
export async function updateApplicantStatus(
  applicantId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  notes?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('applicants')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      notes: notes || null
    })
    .eq('id', applicantId);

  if (error) {
    console.error('Error updating applicant status:', error);
    return false;
  }

  return true;
}

/**
 * Delete an applicant
 */
export async function deleteApplicant(applicantId: string): Promise<boolean> {
  const { error } = await supabase
    .from('applicants')
    .delete()
    .eq('id', applicantId);

  if (error) {
    console.error('Error deleting applicant:', error);
    return false;
  }

  return true;
}

/**
 * Get applicant by ID
 */
export async function getApplicantById(applicantId: string): Promise<Applicant | null> {
  const { data, error } = await supabase
    .from('applicants')
    .select('*')
    .eq('id', applicantId)
    .single();

  if (error) {
    console.error('Error fetching applicant:', error);
    return null;
  }

  return data as Applicant;
}

// ============ DIVISION REQUEST FUNCTIONS ============

/**
 * Submit a division change request
 */
export async function submitDivisionRequest(request: {
  member_id: string;
  member_name: string;
  division: string;
}): Promise<DivisionRequest | null> {
  const { data, error } = await supabase
    .from('division_requests')
    .insert([{
      ...request,
      status: 'pending',
      requested_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error('Error submitting division request:', error);
    return null;
  }

  return data as DivisionRequest;
}

/**
 * Get pending division requests (for a specific division head or all)
 */
export async function getDivisionRequests(division?: string): Promise<DivisionRequest[]> {
  let query = supabase
    .from('division_requests')
    .select('*')
    .order('requested_at', { ascending: false });

  if (division) {
    query = query.eq('division', division);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching division requests:', error);
    return [];
  }

  return data as DivisionRequest[];
}

/**
 * Get pending division requests count
 */
export async function getPendingDivisionRequestsCount(division?: string): Promise<number> {
  let query = supabase
    .from('division_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (division) {
    query = query.eq('division', division);
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error fetching pending requests count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Approve a division request - adds the division to member and updates request status
 */
export async function approveDivisionRequest(
  requestId: string,
  reviewedBy: string
): Promise<boolean> {
  console.log('Approving division request:', requestId);

  // First get the request details
  const { data: request, error: fetchError } = await supabase
    .from('division_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    console.error('Error fetching request:', fetchError);
    return false;
  }

  console.log('Request details:', request);

  // Get current member details (need name for division table)
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('division, name, role')
    .eq('member_id', request.member_id)
    .single();

  if (memberError || !member) {
    console.error('Error fetching member:', memberError);
    return false;
  }

  console.log('Member details:', member);

  // Add new division to existing divisions
  const currentDivisions = member.division ? member.division.split(',').map((d: string) => d.trim()) : [];
  console.log('Current divisions:', currentDivisions);

  if (!currentDivisions.includes(request.division)) {
    currentDivisions.push(request.division);
  }
  const newDivisionString = currentDivisions.join(', ');
  console.log('New division string:', newDivisionString);

  // Update member's division
  const { error: updateMemberError } = await supabase
    .from('members')
    .update({ division: newDivisionString })
    .eq('member_id', request.member_id);

  if (updateMemberError) {
    console.error('Error updating member division:', updateMemberError);
    return false;
  }

  console.log('Updated member division successfully');

  // Add member to the specific division table
  const divisionTableResult = await addMemberToDivisionTable(
    request.member_id,
    member.name,
    request.division,
    member.role
  );
  console.log('Division table update result:', divisionTableResult);

  // Update request status
  const { error: updateRequestError } = await supabase
    .from('division_requests')
    .update({
      status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (updateRequestError) {
    console.error('Error updating request status:', updateRequestError);
    return false;
  }

  console.log('Division request approved successfully');
  return true;
}

/**
 * Reject a division request
 */
export async function rejectDivisionRequest(
  requestId: string,
  reviewedBy: string,
  notes?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('division_requests')
    .update({
      status: 'rejected',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      notes: notes || null
    })
    .eq('id', requestId);

  if (error) {
    console.error('Error rejecting request:', error);
    return false;
  }

  return true;
}

/**
 * Check if a member already has a pending request for a division
 */
export async function hasPendingDivisionRequest(memberId: string, division: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('division_requests')
    .select('id')
    .eq('member_id', memberId)
    .eq('division', division)
    .eq('status', 'pending')
    .limit(1);

  if (error) {
    console.error('Error checking pending request:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Check if a member has submitted any division request in the last week
 * Returns the date of last request if within a week, null otherwise
 */
export async function getLastDivisionRequestDate(memberId: string): Promise<string | null> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('division_requests')
    .select('requested_at')
    .eq('member_id', memberId)
    .gte('requested_at', oneWeekAgo.toISOString())
    .order('requested_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error checking last request date:', error);
    return null;
  }

  return data && data.length > 0 ? data[0].requested_at : null;
}

/**
 * Check if member can submit a new division request (rate limit: 1 per week)
 */
export async function canSubmitDivisionRequest(memberId: string): Promise<{ allowed: boolean; nextAllowedDate?: string; message?: string }> {
  const lastRequestDate = await getLastDivisionRequestDate(memberId);

  if (!lastRequestDate) {
    return { allowed: true };
  }

  const lastRequest = new Date(lastRequestDate);
  const nextAllowed = new Date(lastRequest);
  nextAllowed.setDate(nextAllowed.getDate() + 7);

  const now = new Date();

  if (now < nextAllowed) {
    const daysRemaining = Math.ceil((nextAllowed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      allowed: false,
      nextAllowedDate: nextAllowed.toLocaleDateString(),
      message: `You can only submit one division request per week. Try again in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}.`
    };
  }

  return { allowed: true };
}

// Note: getCouncilMembers is defined earlier in this file (around line 180)
// Used for both council section display and notifications

/**
 * Send division request notifications to division head and all council members
 */
export async function notifyDivisionRequest(
  requesterName: string,
  division: string,
  divisionHeadId: string
): Promise<boolean> {
  try {
    // Get all council members
    const councilMembers = await getCouncilMembers();

    // Create notifications for all council members
    const notifications = councilMembers.map(member => ({
      member_id: member.member_id,
      type: 'system' as const,
      title: member.member_id === divisionHeadId
        ? `Division Request - Action Required`
        : `Division Request - ${division}`,
      message: member.member_id === divisionHeadId
        ? `${requesterName} has requested to join your division (${division}). Please review and approve/reject.`
        : `${requesterName} has requested to join ${division} division.`,
      link: member.member_id === divisionHeadId ? '/team?tab=requests' : undefined
    }));

    await createBulkNotifications(notifications);
    return true;
  } catch (error) {
    console.error('Error sending notifications:', error);
    return false;
  }
}

/**
 * Delete division requests older than 7 days
 * Called periodically to clean up old data
 */
export async function deleteOldDivisionRequests(): Promise<number> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('division_requests')
    .delete()
    .lt('requested_at', oneWeekAgo.toISOString())
    .select('id');

  if (error) {
    console.error('Error deleting old division requests:', error);
    return 0;
  }

  const count = data?.length || 0;
  if (count > 0) {
    console.log(`Deleted ${count} old division request(s)`);
  }
  return count;
}

// ==========================================
// DIVISION-SPECIFIC DATABASE FUNCTIONS
// ==========================================

/**
 * Mapping of division names to their respective database table names
 */
export const DIVISION_TABLE_MAP: { [key: string]: string } = {
  'Drone': 'drone_members',
  'RC Plane': 'rc_plane_members',
  'Rocketry': 'rocketry_members',
  'Management': 'management_members',
  'Creative/Web-Dev': 'creative_members'
};

/**
 * Add a member to a specific division table
 */
export async function addMemberToDivisionTable(
  memberId: string,
  memberName: string,
  division: string,
  role?: string
): Promise<boolean> {
  const tableName = DIVISION_TABLE_MAP[division];
  if (!tableName) {
    console.warn(`Unknown division: ${division}`);
    return false;
  }

  // Check if member already exists in this division table
  const { data: existing } = await supabase
    .from(tableName)
    .select('member_id')
    .eq('member_id', memberId)
    .single();

  if (existing) {
    console.log(`Member ${memberId} already exists in ${tableName}`);
    return true; // Already exists, consider it success
  }

  const { error } = await supabase
    .from(tableName)
    .insert([{
      member_id: memberId,
      name: memberName,
      role: role || 'Member',
      joined_at: new Date().toISOString()
    }]);

  if (error) {
    console.error(`Error adding member to ${tableName}:`, error);
    return false;
  }

  console.log(`Added ${memberName} (${memberId}) to ${tableName}`);
  return true;
}

/**
 * Add a member to multiple division tables based on comma-separated division string
 */
export async function addMemberToAllDivisionTables(
  memberId: string,
  memberName: string,
  divisionString: string,
  role?: string
): Promise<boolean> {
  const divisions = divisionString.split(',').map(d => d.trim());
  let allSuccess = true;

  for (const division of divisions) {
    const success = await addMemberToDivisionTable(memberId, memberName, division, role);
    if (!success) {
      allSuccess = false;
    }
  }

  return allSuccess;
}

/**
 * Remove a member from a specific division table
 */
export async function removeMemberFromDivisionTable(
  memberId: string,
  division: string
): Promise<boolean> {
  const tableName = DIVISION_TABLE_MAP[division];
  if (!tableName) {
    console.warn(`Unknown division: ${division}`);
    return false;
  }

  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('member_id', memberId);

  if (error) {
    console.error(`Error removing member from ${tableName}:`, error);
    return false;
  }

  console.log(`Removed ${memberId} from ${tableName}`);
  return true;
}

/**
 * Remove a member from all division tables
 */
export async function removeMemberFromAllDivisionTables(
  memberId: string
): Promise<boolean> {
  const promises = Object.values(DIVISION_TABLE_MAP).map(tableName =>
    supabase
      .from(tableName)
      .delete()
      .eq('member_id', memberId)
  );

  const results = await Promise.all(promises);

  // Check if any request failed
  const hasError = results.some(r => r.error);
  if (hasError) {
    console.warn('One or more division table deletions failed for:', memberId);
    // We return true anyway because new insertions often fix this, 
    // and we don't want to block approval for cleanup errors.
    return true;
  }

  return true;
}

/**
 * Get all members from a specific division table
 */
export async function getDivisionMembers(division: string): Promise<Array<{
  member_id: string;
  name: string;
  role: string;
  joined_at: string;
}>> {
  const tableName = DIVISION_TABLE_MAP[division];
  if (!tableName) {
    console.warn(`Unknown division: ${division}`);
    return [];
  }

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .order('joined_at', { ascending: false });

  if (error) {
    console.error(`Error fetching members from ${tableName}:`, error);
    return [];
  }

  return data || [];
}

/**
 * Update a member's role in a division table
 */
export async function updateMemberRoleInDivision(
  memberId: string,
  division: string,
  newRole: string
): Promise<boolean> {
  const tableName = DIVISION_TABLE_MAP[division];
  if (!tableName) {
    console.warn(`Unknown division: ${division}`);
    return false;
  }

  const { error } = await supabase
    .from(tableName)
    .update({ role: newRole })
    .eq('member_id', memberId);

  if (error) {
    console.error(`Error updating role in ${tableName}:`, error);
    return false;
  }

  return true;
}

// ==========================================
// SUPER ADMIN & COUNCIL TRANSFER FUNCTIONS
// ==========================================

/**
 * Create or get the immutable UDAAN-000 super admin account
 * This account has the highest authority and cannot be deleted or downgraded
 * NOTE: Admin function - needs full access
 */
export async function initializeSuperAdmin(): Promise<Member | null> {
  // Check if super admin already exists
  const { data: existing } = await supabase
    .from('members')
    .select('member_id, name, email, role, division, clearance, year, status')
    .eq('member_id', 'UDAAN-000')
    .single();

  if (existing) {
    return existing as Member;
  }

  // Create the super admin account with secure password
  const securePassword = generateSecurePassword(16);
  const hashedPassword = await bcrypt.hash(securePassword, 10);

  const { data, error } = await supabase
    .from('members')
    .insert([{
      member_id: 'UDAAN-000',
      name: 'UDAAN Administration',
      email: 'admin@udaan.nitrkl.ac.in',
      password: hashedPassword, // Securely hashed
      role: 'Super Admin',
      division: 'Administration',
      clearance: 9, // Highest clearance level
      year: 0, // Not a regular member
      status: 'approved',
      created_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating super admin:', error);
    return null;
  }

  return data as Member;
}

/**
 * Check if a member is the super admin (UDAAN-000)
 */
export function isSuperAdmin(memberId: string): boolean {
  return memberId === 'UDAAN-000';
}

/**
 * Get all active council members (clearance level 5, excluding super admin)
 * SECURITY: Uses secure view for public-safe results
 */
export async function getActiveCouncilMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('public_team_members')  // Use secure view
    .select('member_id, name, role, division, year, department, profile_pic, clearance')
    .eq('clearance', 5)
    .neq('member_id', 'UDAAN-000')
    .order('member_id', { ascending: true });

  if (error) {
    return [];
  }

  return data as Member[];
}

/**
 * Transfer council authority (ONLY UDAAN-000 can do this)
 * This is the most critical operation - handles ID migration for all year levels
 * 
 * UPDATED RULES (Council selected from 2nd year):
 * - Selected 2nd years → New Council + 3rd year: Get IDs UDAAN-001, UDAAN-002, etc.
 * - Non-selected 2nd years → 3rd year: UDAAN-20XX → UDAAN-30XX
 * - 3rd years → 4th year: UDAAN-30XX → UDAAN-40XX
 * - 1st years → 2nd year: UDAAN-10XX → UDAAN-20XX
 * - 4th years → Alumni: A-000X format
 * 
 * ROLE ASSIGNMENT ORDER (enforced by UI):
 * 1. President
 * 2. Vice President
 * 3. Creative Head (Secretary eligible)
 * 4. Management Lead & Treasurer (Secretary eligible)
 * 5. Drone Lead (Secretary eligible)
 * 6. RC Lead (Secretary eligible)
 * 7. Rocket Lead (Secretary eligible)
 * 8. Secretary Designation (LAST - must be one of positions 3-7)
 * 
 * Secretary is a DESIGNATION added to an eligible position, not a separate role.
 * President and Vice President cannot be designated as Secretary.
 * 
 * Activity log for UDAAN-000 is purged after successful transfer
 */

// Council position ID type for role assignments (7 positions)
type CouncilPositionId = 'president' | 'vice_president' | 'creative_head' | 'management_lead' | 'drone_lead' | 'rc_lead' | 'rocket_lead';

// Map position IDs to display roles
const POSITION_TO_ROLE: Record<CouncilPositionId, string> = {
  'president': 'President',
  'vice_president': 'Vice President',
  'creative_head': 'Creative Head',
  'management_lead': 'Management Lead & Treasurer',
  'drone_lead': 'Drone Lead',
  'rc_lead': 'RC Lead',
  'rocket_lead': 'Rocket Lead'
};

// Positions eligible for Secretary designation (not President/VP)
const SECRETARY_ELIGIBLE_POSITIONS: CouncilPositionId[] = [
  'creative_head', 'management_lead', 'drone_lead', 'rc_lead', 'rocket_lead'
];

export async function transferCouncil(
  superAdminId: string,
  newCouncilMemberIds: string[],
  roleAssignments?: Record<string, CouncilPositionId>,
  secretaryId?: string
): Promise<{ success: boolean; message: string; transferredMembers?: string[] }> {
  // Verify caller is super admin
  if (!isSuperAdmin(superAdminId)) {
    return { success: false, message: 'Only UDAAN-000 can transfer council authority' };
  }

  if (newCouncilMemberIds.length === 0) {
    return { success: false, message: 'Must select at least one member for new council' };
  }

  // VALIDATION: Role assignments are now required
  if (!roleAssignments || Object.keys(roleAssignments).length === 0) {
    return { success: false, message: 'Role assignments are required for council transfer' };
  }

  // VALIDATION: Must have all 7 positions assigned
  const assignedPositions = Object.values(roleAssignments);
  const requiredPositions: CouncilPositionId[] = ['president', 'vice_president', 'creative_head', 'management_lead', 'drone_lead', 'rc_lead', 'rocket_lead'];

  for (const pos of requiredPositions) {
    if (!assignedPositions.includes(pos)) {
      return { success: false, message: `${POSITION_TO_ROLE[pos]} must be assigned` };
    }
  }

  // VALIDATION: Secretary designation is required
  if (!secretaryId) {
    return { success: false, message: 'Secretary must be designated' };
  }

  // VALIDATION: Secretary must be assigned to an eligible position (not President/VP)
  const secretaryPosition = roleAssignments[secretaryId];
  if (!secretaryPosition) {
    return { success: false, message: 'Secretary must be a council member' };
  }
  if (!SECRETARY_ELIGIBLE_POSITIONS.includes(secretaryPosition)) {
    return { success: false, message: 'Secretary cannot be the President or Vice President' };
  }

  // VALIDATION: No duplicate position assignments (one position per member)
  const memberIds = Object.keys(roleAssignments);
  const uniquePositions = new Set(assignedPositions);
  if (assignedPositions.length !== uniquePositions.size) {
    return { success: false, message: 'Each position can only be assigned to one member' };
  }

  try {
    // ========== PHASE 1: Validate new council members are 2nd year (UPDATED from 3rd year) ==========
    const { data: selectedMembers, error: selectError } = await supabase
      .from('members')
      .select('*')
      .in('member_id', newCouncilMemberIds);

    if (selectError || !selectedMembers) {
      throw new Error('Failed to fetch selected members');
    }

    // UPDATED: Verify all selected members are 2nd year (not 3rd year) and not already council
    for (const member of selectedMembers) {
      if (member.year !== 2) {
        return { success: false, message: `${member.name} is not a 2nd year member. Only 2nd year members can be selected for council.` };
      }
      if (member.clearance === 5 && member.role.includes('Council')) {
        return { success: false, message: `${member.name} is already council` };
      }
    }

    // ========== PHASE 2: Get all members by year/status ==========
    const { data: allMembers, error: fetchError } = await supabase
      .from('members')
      .select('*')
      .neq('member_id', 'UDAAN-000')
      .eq('status', 'approved')
      .order('member_id', { ascending: true });

    if (fetchError || !allMembers) {
      throw new Error('Failed to fetch all members');
    }

    // ========== PHASE 3: Prepare ID migration mappings ==========
    interface MemberUpdate {
      oldId: string;
      newId?: string;
      oldYear: number;
      newYear?: number;
      oldRole: string;
      newRole: string;
      oldClearance: number;
      newClearance: number;
      updates: any;
    }

    const migrations: MemberUpdate[] = [];

    // A. NEW COUNCIL: Selected 2nd year members → UDAAN-00X format + become 3rd year
    // UPDATED: Source changed from 3rd year to 2nd year
    // UPDATED: Role is now determined by roleAssignments parameter + secretaryId

    // Sort selected members by their assigned position order for consistent ID assignment
    const positionOrder: CouncilPositionId[] = ['president', 'vice_president', 'creative_head', 'management_lead', 'drone_lead', 'rc_lead', 'rocket_lead'];
    const sortedSelectedMembers = selectedMembers.sort((a, b) => {
      const posA = roleAssignments[a.member_id];
      const posB = roleAssignments[b.member_id];
      const orderA = posA ? positionOrder.indexOf(posA) : 99;
      const orderB = posB ? positionOrder.indexOf(posB) : 99;
      return orderA - orderB;
    });

    const newCouncilUpdates = sortedSelectedMembers.map((member, index) => {
      const newId = `UDAAN-${String(index + 1).padStart(3, '0')}`;
      const assignedPosition = roleAssignments[member.member_id];
      // Role includes Secretary designation if this member is the Secretary
      let newRole = assignedPosition ? POSITION_TO_ROLE[assignedPosition] : 'Council Member';
      if (member.member_id === secretaryId) {
        newRole = `${newRole} & Secretary`;
      }

      const update: MemberUpdate = {
        oldId: member.member_id,
        newId,
        oldYear: member.year,
        newYear: 3, // Selected 2nd years become 3rd year council
        oldRole: member.role,
        newRole,
        oldClearance: member.clearance,
        newClearance: 5,
        updates: {
          member_id: newId,
          year: 3, // UPDATED: Explicitly set year to 3
          clearance: 5,
          role: newRole
        }
      };
      return update;
    });
    migrations.push(...newCouncilUpdates);

    // B. NON-SELECTED 2ND YEARS: UDAAN-20XX → UDAAN-30XX (become 3rd year)
    // UPDATED: 2nd years not selected for council just move to 3rd year normally
    const nonSelectedSecondYear = allMembers.filter(m => {
      // Don't process members selected for council
      if (newCouncilMemberIds.includes(m.member_id)) return false;
      // Include only 2nd year members
      return m.year === 2;
    });

    for (const member of nonSelectedSecondYear) {
      const numPart = member.member_id.match(/\d+$/)?.[0] || '001';
      const lastThreeDigits = numPart.slice(-3);
      const newId = `UDAAN-3${lastThreeDigits}`;

      const update: MemberUpdate = {
        oldId: member.member_id,
        newId,
        oldYear: 2,
        newYear: 3,
        oldRole: member.role,
        newRole: member.role,
        oldClearance: member.clearance,
        newClearance: member.clearance,
        updates: {
          member_id: newId,
          year: 3
        }
      };
      migrations.push(update);
    }

    // C. 3RD YEARS + OLD COUNCIL: → 4th year with UDAAN-40XX format
    // UPDATED: All 3rd years (including old council) move to 4th year
    const thirdYearAndOldCouncil = allMembers.filter(m => {
      // Include 3rd year members and old council (clearance 5)
      return m.year === 3 || (m.clearance === 5 && m.member_id.startsWith('UDAAN-0'));
    });

    for (const member of thirdYearAndOldCouncil) {
      const numPart = member.member_id.match(/\d+$/)?.[0] || '001';
      const lastThreeDigits = numPart.slice(-3);
      const newId = `UDAAN-40${lastThreeDigits}`;

      const update: MemberUpdate = {
        oldId: member.member_id,
        newId,
        oldYear: member.year,
        newYear: 4,
        oldRole: member.role,
        newRole: member.role.replace(/Council|3rd Year/, 'Member'),
        oldClearance: member.clearance,
        newClearance: 3,
        updates: {
          member_id: newId,
          year: 4,
          clearance: 3,
          role: member.role.replace(/Council|3rd Year/, 'Member')
        }
      };
      migrations.push(update);
    }

    // D. 1ST YEAR: UDAAN-1XXX → UDAAN-2XXX
    const firstYearMembers = allMembers.filter(m => m.year === 1);
    for (const member of firstYearMembers) {
      const numPart = member.member_id.match(/\d+$/)?.[0] || '001';
      const lastThreeDigits = numPart.slice(-3);
      const newId = `UDAAN-2${lastThreeDigits}`;

      const update: MemberUpdate = {
        oldId: member.member_id,
        newId,
        oldYear: 1,
        newYear: 2,
        oldRole: member.role,
        newRole: member.role,
        oldClearance: member.clearance,
        newClearance: member.clearance,
        updates: {
          member_id: newId,
          year: 2
        }
      };
      migrations.push(update);
    }

    // E. 4TH YEAR → ALUMNI (with A-XXXX ID format)
    // Alumni IDs are permanent and never reused (separate namespace from UDAAN-XXXX)
    const fourthYearMembers = allMembers.filter(m => m.year === 4);

    // Get the highest existing alumni ID to continue the sequence
    const { data: existingAlumni } = await supabase
      .from('members')
      .select('member_id')
      .like('member_id', 'A-%')
      .order('member_id', { ascending: false });

    let nextAlumniNumber = 1;
    if (existingAlumni && existingAlumni.length > 0) {
      const numbers = existingAlumni.map(a => {
        const match = a.member_id.match(/A-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      }).filter(n => !isNaN(n) && n > 0);

      if (numbers.length > 0) {
        nextAlumniNumber = Math.max(...numbers) + 1;
      }
    }

    for (const member of fourthYearMembers) {
      // Generate new alumni ID in A-XXXX format
      const newAlumniId = `A-${String(nextAlumniNumber).padStart(4, '0')}`;
      nextAlumniNumber++;

      const update: MemberUpdate = {
        oldId: member.member_id,
        newId: newAlumniId, // Alumni get new A-XXXX ID
        oldYear: 4,
        newYear: 0, // Alumni year
        oldRole: member.role,
        newRole: 'Alumni',
        oldClearance: member.clearance,
        newClearance: 0, // Alumni clearance (can only view announcements)
        updates: {
          member_id: newAlumniId,
          year: 0,
          clearance: 0,
          role: 'Alumni'
        }
      };
      migrations.push(update);
    }

    // ========== PHASE 4: Execute all migrations ==========
    for (const migration of migrations) {
      // Only update if the ID is changing
      if (migration.newId && migration.newId !== migration.oldId) {
        // Update member record
        const { error: updateError } = await supabase
          .from('members')
          .update(migration.updates)
          .eq('member_id', migration.oldId);

        if (updateError) {
          throw new Error(`Failed to update member ${migration.oldId}: ${updateError.message}`);
        }

        // Update division tables
        const { data: memberData } = await supabase
          .from('members')
          .select('division, role')
          .eq('member_id', migration.newId)
          .single();

        if (memberData && memberData.division) {
          const divisions = memberData.division.split(',').map(d => d.trim());
          for (const division of divisions) {
            const tableName = DIVISION_TABLE_MAP[division];
            if (tableName) {
              await supabase
                .from(tableName)
                .update({ member_id: migration.newId, role: migration.newRole })
                .eq('member_id', migration.oldId);
            }
          }
        }
      }

      // Log the migration
      await logActivity({
        member_id: superAdminId,
        member_name: 'UDAAN Administration',
        action: 'council_transfer',
        details: `Migrated ${migration.oldId} → ${migration.newId || migration.oldId} (Year: ${migration.oldYear} → ${migration.newYear}, Role: ${migration.oldRole} → ${migration.newRole})`,
        target_type: 'member',
        target_id: migration.oldId
      });
    }

    // ========== PHASE 5: Purge UDAAN-000 activity logs (fresh start after transfer) ==========
    // This clears all historical activity log entries for UDAAN-000
    // The council transfer itself will be logged as the first new entry
    const { error: purgeError } = await supabase
      .from('activity_logs')
      .delete()
      .eq('member_id', 'UDAAN-000');

    if (purgeError) {
      // Log purge failure but don't fail the transfer - it's not critical
      console.error('Warning: Failed to purge UDAAN-000 activity logs:', purgeError);
    }

    // Log the council transfer completion as the first new activity for UDAAN-000
    await logActivity({
      member_id: superAdminId,
      member_name: 'UDAAN Administration',
      action: 'council_transfer_complete',
      details: `Council transfer completed successfully. ${migrations.length} members migrated. Activity log reset.`,
      target_type: 'system',
      target_id: 'council_transfer'
    });

    // ========== PHASE 6: Send ID Change Notification Emails ==========
    // Send emails ONLY to members with VERIFIED personal emails
    // Excludes: Alumni, UDAAN-000, members without verified emails
    // Email failure does NOT roll back the transfer
    try {
      // Prepare migration data for email notifications
      const migrationData = migrations.map(m => ({
        oldId: m.oldId,
        newId: m.newId,
        oldRole: m.oldRole,
        newRole: m.newRole
      }));

      // Send notifications asynchronously - don't block return
      // This runs after DB commit is complete
      sendIdChangeNotifications(migrationData).catch(emailErr => {
        // Log email errors but don't affect transfer result
        console.error('Warning: Some ID change emails may have failed:', emailErr);
      });
    } catch (emailError) {
      // Email notification failure should never affect the transfer
      console.error('Warning: Failed to initiate ID change notifications:', emailError);
    }

    return {
      success: true,
      message: `Successfully transferred council. ${migrations.length} members updated.`,
      transferredMembers: migrations.map(m => m.oldId)
    };
  } catch (error: any) {
    console.error('Error transferring council:', error);
    return { success: false, message: `Council transfer failed: ${error.message}` };
  }
}
/**
 * Add alumni manually (ONLY UDAAN-000 can do this)
 * Alumni IDs are in A-XXXX format and are permanent/never reused
 */
export async function addAlumniMember(
  adminId: string,
  alumni: {
    name: string;
    email: string;
    password: string;
    division: string;
    department?: string;
    roll_no?: string;
  }
): Promise<{ success: boolean; message: string; member?: Member }> {
  // Only UDAAN-000 can add alumni
  if (!isSuperAdmin(adminId)) {
    return { success: false, message: 'Only UDAAN-000 can add alumni members' };
  }

  try {
    // Get the next alumni ID
    const { data: existingAlumni } = await supabase
      .from('members')
      .select('member_id')
      .like('member_id', 'A-%')
      .order('member_id', { ascending: false });

    let nextAlumniNumber = 1;
    if (existingAlumni && existingAlumni.length > 0) {
      const numbers = existingAlumni.map(a => {
        const match = a.member_id.match(/A-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      }).filter(n => !isNaN(n) && n > 0);

      if (numbers.length > 0) {
        nextAlumniNumber = Math.max(...numbers) + 1;
      }
    }

    const alumniId = `A-${String(nextAlumniNumber).padStart(4, '0')}`;

    // Insert the alumni member
    const { data, error } = await supabase
      .from('members')
      .insert([{
        member_id: alumniId,
        name: alumni.name,
        email: alumni.email,
        password: alumni.password,
        role: 'Alumni',
        division: alumni.division,
        year: 0, // Alumni year
        clearance: 0, // Alumni clearance
        status: 'approved',
        added_by: adminId,
        department: alumni.department || null,
        roll_no: alumni.roll_no || null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding alumni:', error);
      return { success: false, message: 'Failed to add alumni member' };
    }

    // Log the activity
    await logActivity({
      member_id: adminId,
      member_name: 'UDAAN Administration',
      action: 'alumni_added',
      details: `Added alumni ${alumni.name} with ID ${alumniId}`,
      target_type: 'member',
      target_id: alumniId
    });

    return { success: true, message: `Alumni added with ID: ${alumniId}`, member: data as Member };
  } catch (error: any) {
    console.error('Error adding alumni:', error);
    return { success: false, message: error.message || 'Failed to add alumni' };
  }
}

/**
 * Get all tasks (for UDAAN-000 admin report)
 */
export async function getAllTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all tasks:', error);
    return [];
  }

  return data as Task[];
}

/**
 * Get all activity logs (for UDAAN-000 admin report)
 */
export async function getAllActivityLogs(limit: number = 100): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching activity logs:', error);
    return [];
  }

  return data as ActivityLog[];
}

// ============================================
// PHOTO UPLOAD SYSTEM FOR ID CARD
// ============================================

/**
 * Check if member can upload/change their photo
 * Photo is locked for 365 days after upload
 * Alumni and UDAAN-000 cannot upload photos
 */
export function canUploadPhoto(member: Member): { allowed: boolean; reason?: string; daysRemaining?: number } {
  // UDAAN-000 cannot have a photo
  if (member.member_id === 'UDAAN-000') {
    return { allowed: false, reason: 'System administrator accounts do not have ID cards' };
  }

  // Alumni cannot have a photo
  if (member.role === 'Alumni' || member.clearance === 0) {
    return { allowed: false, reason: 'Alumni members do not have active ID cards' };
  }

  // Check 1-year lock
  if (member.photo_uploaded_at) {
    const uploadDate = new Date(member.photo_uploaded_at);
    const lockEndDate = new Date(uploadDate);
    lockEndDate.setFullYear(lockEndDate.getFullYear() + 1); // 365 days lock

    const now = new Date();
    if (now < lockEndDate) {
      const daysRemaining = Math.ceil((lockEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        allowed: false,
        reason: `Photo cannot be changed for ${daysRemaining} more day${daysRemaining !== 1 ? 's' : ''}`,
        daysRemaining
      };
    }
  }

  return { allowed: true };
}

/**
 * Upload member photo to Supabase Storage
 * Only accepts WebP format (converted client-side)
 * Enforces 1-year lock after upload
 */
export async function uploadMemberPhoto(
  memberId: string,
  webpBlob: Blob
): Promise<{ success: boolean; url?: string; error?: string }> {
  // We trust the blob from convertToWebP - it was created with 'image/webp' type
  // Some browsers may report empty type, so we don't strictly validate here

  // Fetch member to verify they can upload (only fetch needed fields)
  const { data: member, error: fetchError } = await supabase
    .from('members')
    .select('member_id, name, profile_pic, photo_uploaded_at, year, status')
    .eq('member_id', memberId.toUpperCase())
    .single();

  if (fetchError || !member) {
    return { success: false, error: 'Member not found' };
  }

  // Check if upload is allowed (enforced at backend level)
  const canUpload = canUploadPhoto(member as Member);
  if (!canUpload.allowed) {
    return { success: false, error: canUpload.reason };
  }

  // Generate unique filename (stored directly in bucket root)
  const filename = `${memberId.toUpperCase()}_${Date.now()}.webp`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('member-photos')
    .upload(filename, webpBlob, {
      contentType: 'image/webp',
      upsert: true
    });

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('member-photos')
    .getPublicUrl(filename);

  const publicUrl = urlData.publicUrl;

  // Update member record with photo URL and timestamp
  const { error: updateError } = await supabase
    .from('members')
    .update({
      profile_pic: publicUrl,
      photo_uploaded_at: new Date().toISOString()
    })
    .eq('member_id', memberId.toUpperCase());

  if (updateError) {
    return { success: false, error: `Failed to update member record: ${updateError.message}` };
  }

  return { success: true, url: publicUrl };
}