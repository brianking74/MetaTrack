# Security Upgrade - Stage 2 Runbook (Supabase Auth + Row Level Security)

## Why this is needed

The app previously authenticated people inside the browser against records
fetched with the public anon key, and Row Level Security (RLS) was not
enabled. Anyone on the internet could read and write every row of the
`assessments` table, and every record contained plaintext passwords.

This branch (`supabase-auth-migration`) contains the migrated app code:
logins now go through real Supabase Auth sessions, sessions survive page
refresh, passwords exist only as salted hashes in Supabase Auth, and the
database is locked down with RLS policies.

## Cutover runbook (about 30 minutes, brief login downtime)

Do these steps in order. Steps 3-5 are the downtime window.

### 1. Push both branches

```
git push origin security-and-quality-fixes   # Stage 1 (if not merged yet)
git push origin supabase-auth-migration      # Stage 2 app code
```

Merge Stage 1 into `main` first if you have not already. Do NOT merge Stage 2
into `main` until step 4 - otherwise the deployed app would require Auth
accounts that do not exist yet and nobody could sign in.

### 2. Add new users first? (optional)

If you plan to bulk-upload new staff via CSV, upload them with the OLD app
first (or insert rows directly). The import script in step 3 provisions an
Auth account for every email found in the `assessments` table.

### 3. Create Auth accounts for everyone (no downtime yet)

On your computer, inside the repo:

```
npm install
SUPABASE_URL=https://cgczxefpsrskssibdiec.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
node supabase/import-users.mjs
```

- Get both values from Supabase Dashboard -> Project Settings -> API.
- The service_role key is a SECRET. Use it only in this command; never commit
  it or put it in the web app.
- The script is idempotent - safe to re-run (it skips existing accounts).
- The ADMIN account gets a strong random password that is printed ONCE at the
  end. Save it immediately (or set `ADMIN_PASSWORD=...` in the env first).

### 4. Enable Row Level Security (downtime starts)

Open Supabase Dashboard -> SQL Editor, paste the contents of
`supabase/secure_rls.sql`, and run it.

- From this moment the OLD app shows "Cloud Database Unavailable" / logins
  fail - that is expected and means the public hole is closed.
- Proceed to step 5 immediately.

### 5. Deploy the migrated app (downtime ends)

Merge `supabase-auth-migration` into `main` and push. Netlify rebuilds and
the new app goes live with Supabase Auth logins. Verify right away:

- Staff login (email + their existing password) -> sees ONLY their own reviews
- Manager login -> sees only their direct reports
- Admin login (admin@metabev.com + the generated password from step 3) ->
  sees the whole registry
- While logged out: DevTools -> Network shows the assessments request
  returning an empty array (RLS working)

### 6. Erase plaintext passwords from the data

Supabase Dashboard -> SQL Editor, paste and run `supabase/strip_passwords.sql`.
After this, no password exists anywhere in the database outside Auth's hash
store. (Run it only after step 5 is verified, because it permanently deletes
the plaintext values.)

### 7. Close the remaining holes

1. Rotate the anon key: Supabase Dashboard -> Project Settings -> API ->
   Rotate anon key. Then update `VITE_SUPABASE_ANON_KEY` in Netlify -> Site
   settings -> Environment variables and redeploy. The old leaked key is dead
   after this.
2. Disable open signups: Supabase Dashboard -> Authentication -> Sign In /
   Up -> disable "Allow new users to sign up". New staff accounts are
   provisioned only by the import script.
3. Consider deleting the old admin password from wherever it was shared.

### 8. Ongoing: adding new staff

After any CSV bulk upload, re-run the step-3 command to create Auth accounts
for the new people (the app itself reminds you of this after an upload).
Existing accounts are skipped, and nobody's password changes.

## What changed in the app code (this branch)

- `services/supabase.ts`: `signInWithPassword` / `signOut` / `getSession`
  session restore + `onAuthStateChange`, friendly auth error mapping,
  password fields stripped from every payload (defense in depth)
- `App.tsx`: login handlers call Supabase Auth; role resolution now mirrors
  RLS (admin / manager / staff); sessions survive refresh; logout clears the
  per-user cache; hardcoded master password and default-password fallbacks
  removed; pre-login "sync" button removed (meaningless under RLS)
- `types.ts` / `constants.ts`: `managerPassword` / `employeePassword` removed
  from the data model
- `components/AdminDashboard.tsx`: CSV import ignores legacy password columns
- `registry_template.csv`: password columns removed
