// ============================================================
// Netlify Function: create-staff
// ============================================================
// Lets the administrator add a new staff member straight from the
// Admin Hub ("+ Add Staff"): creates the person's Supabase Auth
// account (email + password) so they can log in immediately.
//
// WHY A SERVER FUNCTION: creating Auth accounts requires the
// service_role key (auth.admin.createUser), which must NEVER be
// shipped to the browser. This function runs server-side only and
// verifies that the caller really is the administrator before it
// touches anything.
//
// Required Netlify environment variables (Site configuration ->
// Environment variables):
//   SUPABASE_SERVICE_ROLE_KEY - secret service_role key
//                               (Supabase -> Settings -> API)
//   SUPABASE_URL or VITE_SUPABASE_URL - project URL (the VITE_ one
//                               is normally already set for the build)
//   ADMIN_EMAIL - optional override, defaults to admin@metabev.com
//
// If SUPABASE_SERVICE_ROLE_KEY is missing the function answers with a
// clear "not configured" error - the rest of the portal is unaffected.
//
// Called by the portal as:
//   POST /.netlify/functions/create-staff
//   Authorization: Bearer <the admin's Supabase access token>
//   { "fullName": "...", "email": "...", "password": "...", "managerName": "..." }
//
// Registry rows (the mid-year/final assessment records) are written by
// the app itself right after this succeeds - exactly the same code path
// as the CSV "Upload Registry" flow, so the new person appears in the
// Staff Registry, their manager sees them, and expense claims route to
// the manager on file.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@metabev.com').toLowerCase();

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'POST only' });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, {
      error:
        'Add Staff is not configured yet: add SUPABASE_SERVICE_ROLE_KEY (secret key from Supabase -> Settings -> API) in Netlify -> Site configuration -> Environment variables, then redeploy the site.',
    });
  }

  // ---- 1) Verify the caller is logged in AND is the administrator ----
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return json(401, { error: 'Missing admin session token. Please log in again.' });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let callerEmail = '';
  try {
    const { data, error } = await adminClient.auth.getUser(token);
    if (error || !data?.user) {
      return json(401, { error: 'Invalid or expired session. Please log in again.' });
    }
    callerEmail = (data.user.email || '').toLowerCase();
  } catch (err) {
    return json(401, { error: 'Could not verify your session: ' + String(err) });
  }

  if (callerEmail !== ADMIN_EMAIL) {
    return json(403, { error: 'Only the administrator account can add staff members.' });
  }

  // ---- 2) Validate the input ----
  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const fullName = String(body.fullName || '').trim();
  const email = String(body.email || '').toLowerCase().trim();
  const password = String(body.password || '');
  const managerName = String(body.managerName || '').trim();

  if (!fullName) return json(400, { error: 'Full Name is required.' });
  if (!emailRe.test(email)) return json(400, { error: 'Enter a valid email address.' });
  if (password.length < 6) {
    return json(400, { error: 'Password must be at least 6 characters.' });
  }
  if (!managerName) return json(400, { error: 'Line Manager Name is required.' });

  // ---- 3) Create the Supabase Auth account ----
  // If an account with this email already exists we do NOT fail and we do
  // NOT overwrite the password - we report it so the portal can carry on
  // and reconnect the registry entry to the existing account.
  let authCreated = true;
  try {
    const { error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // pre-provisioned by the admin - no verification email
      user_metadata: {
        full_name: fullName,
        position: 'Staff Member',
        division: 'MetaBev',
        is_admin: false,
      },
    });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('already been registered') || error.code === 'email_exists') {
        authCreated = false;
      } else {
        return json(400, { error: 'Supabase rejected the account: ' + msg });
      }
    }
  } catch (err) {
    return json(500, { error: 'Account creation failed: ' + String(err) });
  }

  return json(200, {
    ok: true,
    authCreated,
    email,
    message: authCreated
      ? `Login account created for ${email}.`
      : `A login account for ${email} already existed - its password was left unchanged.`,
  });
};
