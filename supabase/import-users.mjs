#!/usr/bin/env node
/**
 * One-time migration script: create Supabase Auth accounts for every staff
 * member and manager found in the assessments table, reusing their existing
 * plaintext passwords as the Auth password.
 *
 * WHY: the current app stores plaintext passwords inside every record and the
 * table is readable by anyone. The fix is real Supabase Auth accounts (hashed
 * passwords) + Row Level Security. This script does the account creation so
 * nobody has to reset 100 passwords by hand.
 *
 * HOW TO RUN (on your own computer, never share these keys):
 *   1. npm install @supabase/supabase-js   (inside this repo)
 *   2. Get your keys: Supabase Dashboard -> Settings -> API
 *        - Project URL
 *        - service_role key (secret! grants full database access)
 *   3. SUPABASE_URL=https://cgczxefpsrskssibdiec.supabase.co \
 *      SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> \
 *      node scripts/import-users.mjs
 *
 * The script is idempotent: users that already exist are skipped, so it is
 * safe to run more than once.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = 'metabev2025';
const ADMIN_EMAIL = 'admin@metabev.com';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.');
  console.error('Never paste the service_role key into the web app or commit it anywhere.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const normalize = (s) => (s || '').toLowerCase().trim();

async function main() {
  console.log('Fetching existing assessments...');
  const { data: rows, error } = await supabase
    .from('assessments')
    .select('data');

  if (error) {
    console.error('Failed to fetch assessments:', error.message);
    process.exit(1);
  }

  // Build a map: email -> { password, name, position, division, isManager }
  const people = new Map();

  for (const row of rows) {
    const a = row.data || {};
    const empEmail = normalize(a.employeeDetails?.email);
    const mgrEmail = normalize(a.managerEmail);

    if (empEmail && !people.has(empEmail)) {
      people.set(empEmail, {
        email: empEmail,
        password: a.employeePassword || DEFAULT_PASSWORD,
        name: a.employeeDetails?.fullName || '',
        position: a.employeeDetails?.position || 'Staff',
        division: a.employeeDetails?.division || 'MetaBev',
        isAdmin: false,
      });
    }

    if (mgrEmail && !people.has(mgrEmail)) {
      // Manager password may come from any record they manage
      people.set(mgrEmail, {
        email: mgrEmail,
        password: a.managerPassword || DEFAULT_PASSWORD,
        name: a.managerName || 'Manager',
        position: 'Manager',
        division: 'MetaBev',
        isAdmin: false,
      });
    } else if (mgrEmail && !a.managerPassword) {
      // keep existing password if this record has none
    }
  }

  // The administrator account
  if (!people.has(ADMIN_EMAIL)) {
    people.set(ADMIN_EMAIL, {
      email: ADMIN_EMAIL,
      password: '',
      name: 'System Administrator',
      position: 'Administrator',
      division: 'MetaBev',
      isAdmin: true,
    });
  } else {
    people.get(ADMIN_EMAIL).isAdmin = true;
  }

  // Admin password: from env, or generate a strong random one and print it ONCE
  const admin = people.get(ADMIN_EMAIL);
  if (!admin.password || admin.password === DEFAULT_PASSWORD) {
    admin.password = process.env.ADMIN_PASSWORD || ('Mb-' + crypto.randomUUID().slice(0, 13));
    admin.generatedPassword = true;
  }

  console.log(`Found ${people.size} unique people. Creating Auth accounts...`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const person of people.values()) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: person.email,
      password: person.password,
      email_confirm: true, // no email verification needed - accounts are pre-provisioned
      user_metadata: {
        full_name: person.name,
        position: person.position,
        division: person.division,
        is_admin: person.isAdmin,
      },
    });

    if (error) {
      if (error.message?.includes('already been registered') || error.code === 'email_exists') {
        skipped++;
        console.log(`  = ${person.email} already exists, skipped`);
      } else {
        failed++;
        console.error(`  x ${person.email}: ${error.message}`);
      }
    } else {
      created++;
      console.log(`  + created ${person.email}${person.isAdmin ? ' (admin)' : ''}`);
    }
  }

  console.log('\nDone.');
  console.log(`  created: ${created}`);
  console.log(`  skipped (already existed): ${skipped}`);
  console.log(`  failed: ${failed}`);

  if (admin.generatedPassword && created > 0) {
    console.log('\n==============================================');
    console.log(`ADMIN PASSWORD for ${ADMIN_EMAIL}:`);
    console.log(`  ${admin.password}`);
    console.log('Copy this somewhere safe NOW - it will not be shown again.');
    console.log('==============================================');
  }

  console.log('\nNEXT STEPS:');
  console.log('  1. Run supabase/secure_rls.sql in the Supabase SQL Editor');
  console.log('  2. Deploy the migrated app (Supabase Auth branch)');
  console.log('  3. Verify logins for a staff member, a manager, and the admin');
  console.log('  4. Run supabase/strip_passwords.sql to erase plaintext passwords');
  console.log('  5. Log in as admin and change the admin password if it was generated');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
