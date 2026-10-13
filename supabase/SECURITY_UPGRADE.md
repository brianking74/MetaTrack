# Security Upgrade Plan - Stage 2 (Supabase Auth + Row Level Security)

## Why this is needed

The app currently authenticates people inside the browser against records that
were fetched from Supabase using the public anon key. Because the anon key is
public by design and Row Level Security (RLS) is not enabled, **anyone on the
internet can currently read and write every record** in the `assessments`
table (verified during the Oct 2026 audit). Logins in the browser are cosmetic
and every record also contains plaintext passwords.

Stage 1 (already applied in this repo) reduces exposure in the code, but the
database itself is only truly secured by this Stage 2 migration.

## What Stage 2 changes

| Before | After |
|---|---|
| Passwords checked in browser code | Real Supabase Auth sessions (`signInWithPassword`) |
| Plaintext passwords stored in every record | Passwords live only as salted hashes in Supabase Auth |
| Anyone with the anon key reads/writes everything | RLS: staff see own rows, managers see their reports, admin sees all |
| Whole database downloaded to every visitor's browser | Each session fetches only rows that user is allowed to see |
| Admin/master password hardcoded in source | Real admin Auth account (random password, changeable) |

## Runbook (about 30 minutes, brief login downtime)

1. **Install the migration script deps** (on your computer, inside the repo):
   `npm install`
2. **Create Auth accounts for everyone:**
   ```
   SUPABASE_URL=https://<your-project>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
   node supabase/import-users.mjs
   ```
   - Get both values from Supabase Dashboard -> Settings -> API.
   - The service_role key is a SECRET. Only use it in this command; never
     commit it or put it in the web app.
   - The script is safe to re-run; it skips users that already exist.
   - If the admin account gets a generated password, the script prints it
     once - save it immediately.
3. **Enable Row Level Security:** open Supabase Dashboard -> SQL Editor, paste
   `supabase/secure_rls.sql`, and run it.
   - From this moment the OLD app version will show "Cloud Database
     Unavailable" - that is expected and means the hole is closed.
4. **Deploy the migrated app** (I will prepare this branch when you are ready
   for this step - the code changes are small and contained to login +
   session handling).
5. **Verify:**
   - Staff login works and shows only their own reviews
   - Manager login works and shows only their reports
   - Admin login works and sees the registry
   - Logged-out visitor: DevTools -> Network shows the assessments request
     returning an empty array (RLS working)
6. **Erase plaintext passwords from the data:** run
   `supabase/strip_passwords.sql` in the SQL Editor.
7. **Rotate the old anon key** (optional but recommended): Supabase Dashboard
   -> Settings -> API -> Rotate anon key, then update
   `VITE_SUPABASE_ANON_KEY` in Netlify and redeploy. Also delete the old key
   from Git history consideration - once rotated, the leaked one is dead.

## Stage 2 app code changes (prepared when you schedule the cutover)

- `services/supabase.ts`: add `supabase.auth.getSession()` restore + `signInWithPassword`
- `App.tsx`: login handlers call Supabase Auth; remove
  `MASTER_ADMIN_PASSWORD`, default-password fallbacks, and the password
  fields from all types/payloads
- `types.ts` / `constants.ts`: drop `managerPassword` / `employeePassword`
- CSV template: drop the two password columns
