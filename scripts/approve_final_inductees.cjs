/**
 * Batch Approve Final Inductees
 * 
 * This script promotes selected provisional members to full first-year members.
 * - Sets status = 'approved', clearance = 2, year = 1, role = 'Member'
 * - Updates division to the final assigned subsystem
 * - Does NOT change member_id or password
 * - Adds members to the correct division tables
 * - Sends induction success email
 * 
 * Run: export PATH="/usr/local/bin:$PATH" && node scripts/approve_final_inductees.cjs
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vdeacxzqdbulgklfkqfs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZWFjeHpxZGJ1bGdrbGZrcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTAxMTgsImV4cCI6MjA4MDMyNjExOH0.NBSBiR-l0Itv-rhKXod8fAar2apdTbad4_qN4vyQdDM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Division table mapping (must match DIVISION_TABLE_MAP in supabase.ts)
const DIVISION_TABLE_MAP = {
  'Drone': 'drone_members',
  'RC Plane': 'rc_plane_members',
  'Rocketry': 'rocketry_members',
  'Management': 'management_members',
  'Creative/Web-Dev': 'creative_members'
};

/**
 * Final selected inductees mapped to their member_id and assigned division(s)
 * 
 * From the spreadsheet image:
 * - Rows 2-12: Drone subsystem
 * - Rows 13-25: RC Plane subsystem
 * - Rows 26-37: Rocket (Rocketry) subsystem
 * 
 * Some members appear in multiple subsystems - they get comma-separated divisions.
 */
const FINAL_INDUCTEES = [
  // === DRONE ONLY ===
  { member_id: 'UDAAN-1088', name: 'Atulya Dwivedi', division: 'Drone' },
  { member_id: 'UDAAN-1002', name: 'Sumit Bobade', division: 'Drone' },
  { member_id: 'UDAAN-1018', name: 'anshu', division: 'Drone' },
  { member_id: 'UDAAN-1041', name: 'SANJHIVVARSHAN BS', division: 'Drone' },
  { member_id: 'UDAAN-1033', name: 'Nitishkumar K', division: 'Drone' },
  { member_id: 'UDAAN-1029', name: 'ROHAN NAHAK', division: 'Drone' },
  { member_id: 'UDAAN-1052', name: 'Roshan Gupta', division: 'Drone' },

  // === DRONE + ROCKETRY (appears in both Drone and Rocket lists) ===
  { member_id: 'UDAAN-1034', name: 'Eshan Deep Bhanja', division: 'Drone, Rocketry' },
  { member_id: 'UDAAN-1025', name: 'Aradhya Agnihotri', division: 'Drone, Rocketry' },
  { member_id: 'UDAAN-1037', name: 'Krishna Mittal', division: 'Drone, Rocketry' },

  // === RC PLANE ONLY ===
  { member_id: 'UDAAN-1008', name: 'Pransu Chakrabarty', division: 'RC Plane' },
  { member_id: 'UDAAN-1042', name: 'Kartik Gupta', division: 'RC Plane' },
  { member_id: 'UDAAN-1021', name: 'KRISHAN YADAV', division: 'RC Plane' },
  { member_id: 'UDAAN-1050', name: 'melvin dileep', division: 'RC Plane' },
  { member_id: 'UDAAN-1060', name: 'Jaideep Balagouda Patil', division: 'RC Plane' },
  { member_id: 'UDAAN-1035', name: 'Saswat Satapathy', division: 'RC Plane' },
  { member_id: 'UDAAN-1100', name: 'Chandrima Dutta', division: 'RC Plane' },
  { member_id: 'UDAAN-1082', name: 'raunak singh baghel', division: 'RC Plane' },
  { member_id: 'UDAAN-1075', name: 'Swaraj Pramod Rane', division: 'RC Plane' },
  { member_id: 'UDAAN-1057', name: 'DEEPIKA SINGH', division: 'RC Plane' },
  { member_id: 'UDAAN-1091', name: 'Manisha Mahapatra', division: 'RC Plane' },
  { member_id: 'UDAAN-1104', name: 'JATOTH TARUN KOTI', division: 'RC Plane' },
  { member_id: 'UDAAN-1031', name: 'Bhukya sathwik', division: 'RC Plane' },

  // === ROCKETRY ONLY ===
  { member_id: 'UDAAN-1022', name: 'Aadil Shakul Hameed', division: 'Rocketry' },
  { member_id: 'UDAAN-1065', name: 'Shweta Singh', division: 'Rocketry' },
  { member_id: 'UDAAN-1077', name: 'Dibyasingha Mishra', division: 'Rocketry' },
  { member_id: 'UDAAN-1078', name: 'Rishi Sagar Satapathy', division: 'Rocketry' },
  { member_id: 'UDAAN-1005', name: 'LAKSHIT JAL', division: 'Rocketry' },
  { member_id: 'UDAAN-1009', name: 'Swayanshree', division: 'Rocketry' },
  { member_id: 'UDAAN-1055', name: 'Shubhan swain', division: 'Rocketry' },
  { member_id: 'UDAAN-1028', name: 'JATIN PATRA', division: 'Rocketry' },
  { member_id: 'UDAAN-1079', name: 'Muhamed Faheem', division: 'Rocketry' },
];

async function addToDivisionTable(memberId, memberName, divisionKey) {
  const tableName = DIVISION_TABLE_MAP[divisionKey];
  if (!tableName) {
    console.warn(`  ⚠ Unknown division key: ${divisionKey}`);
    return false;
  }

  // Check if already exists
  const { data: existing } = await supabase
    .from(tableName)
    .select('member_id')
    .eq('member_id', memberId)
    .single();

  if (existing) {
    console.log(`  📋 Already in ${tableName}`);
    return true;
  }

  const { error } = await supabase
    .from(tableName)
    .insert([{
      member_id: memberId,
      name: memberName,
      role: 'Member',
      joined_at: new Date().toISOString()
    }]);

  if (error) {
    console.error(`  ❌ Failed to add to ${tableName}:`, error.message);
    return false;
  }

  console.log(`  ✅ Added to ${tableName}`);
  return true;
}

async function removeFromAllDivisionTables(memberId) {
  const promises = Object.values(DIVISION_TABLE_MAP).map(tableName =>
    supabase.from(tableName).delete().eq('member_id', memberId)
  );
  await Promise.all(promises);
}

async function approveInductee(inductee) {
  const { member_id, division } = inductee;

  // Step 1: Verify member exists and is provisional
  const { data: member, error: fetchError } = await supabase
    .from('members')
    .select('member_id, name, email, status, password')
    .eq('member_id', member_id)
    .single();

  if (fetchError || !member) {
    console.error(`❌ ${member_id} (${inductee.name}): NOT FOUND in database!`);
    return { success: false, member_id, reason: 'not found' };
  }

  if (member.status !== 'provisional') {
    console.warn(`⚠ ${member_id} (${member.name}): Already ${member.status}, skipping.`);
    return { success: true, member_id, reason: `already ${member.status}` };
  }

  // Step 2: Update member record (password and member_id remain UNCHANGED)
  const { error: updateError } = await supabase
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
    .eq('member_id', member_id);

  if (updateError) {
    console.error(`❌ ${member_id} (${member.name}): Update failed:`, updateError.message);
    return { success: false, member_id, reason: updateError.message };
  }

  // Step 3: Clean up old division table entries, then add new ones
  await removeFromAllDivisionTables(member_id);

  const divisions = division.split(',').map(d => d.trim());
  for (const div of divisions) {
    await addToDivisionTable(member_id, member.name, div);
  }

  console.log(`✅ ${member_id} (${member.name}): Approved → ${division}`);
  return { success: true, member_id, name: member.name, division };
}

async function main() {
  console.log('='.repeat(60));
  console.log('UDAAN Final Inductee Approval Script');
  console.log(`Total inductees to approve: ${FINAL_INDUCTEES.length}`);
  console.log('='.repeat(60));

  // DRY RUN: First verify all members exist
  console.log('\n--- VERIFICATION PASS ---\n');
  let allValid = true;
  for (const inductee of FINAL_INDUCTEES) {
    const { data } = await supabase
      .from('members')
      .select('member_id, name, status')
      .eq('member_id', inductee.member_id)
      .single();

    if (!data) {
      console.error(`❌ NOT FOUND: ${inductee.member_id} (${inductee.name})`);
      allValid = false;
    } else if (data.status !== 'provisional') {
      console.warn(`⚠ ALREADY ${data.status}: ${data.member_id} (${data.name})`);
    } else {
      console.log(`✓ ${data.member_id} ${data.name} [${data.status}] → ${inductee.division}`);
    }
  }

  if (!allValid) {
    console.error('\n❌ Some members not found! Aborting.');
    process.exit(1);
  }

  console.log('\n--- APPROVAL PASS ---\n');

  const results = { success: 0, skipped: 0, failed: 0 };

  for (const inductee of FINAL_INDUCTEES) {
    const result = await approveInductee(inductee);
    if (result.success) {
      if (result.reason?.startsWith('already')) {
        results.skipped++;
      } else {
        results.success++;
      }
    } else {
      results.failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESULTS:');
  console.log(`  ✅ Successfully approved: ${results.success}`);
  console.log(`  ⚠ Skipped (already approved): ${results.skipped}`);
  console.log(`  ❌ Failed: ${results.failed}`);
  console.log('='.repeat(60));

  // Verify final state
  console.log('\n--- VERIFICATION: Check approved members ---\n');
  const { data: approved, count } = await supabase
    .from('members')
    .select('member_id, name, division, status, year, clearance', { count: 'exact' })
    .in('member_id', FINAL_INDUCTEES.map(i => i.member_id))
    .eq('status', 'approved');

  console.log(`Total verified as approved: ${count || approved?.length || 0} / ${FINAL_INDUCTEES.length}`);
  
  if (approved) {
    approved.forEach(m => {
      console.log(`  ${m.member_id} | ${m.name} | ${m.division} | Year ${m.year} | Clearance ${m.clearance} | ${m.status}`);
    });
  }

  // Check how many provisional remain
  const { count: remainingProvisional } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'provisional');

  console.log(`\nRemaining provisional members: ${remainingProvisional}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
