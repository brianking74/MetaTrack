-- ============================================================
-- STAGE 2 (optional cleanup): Remove plaintext passwords from data rows
-- ============================================================
-- Run ONLY after:
--   1. scripts/import-users.mjs has created Auth accounts for everyone
--   2. the migrated app (Supabase Auth logins) is deployed and verified
--
-- After this, nobody's password exists anywhere in the database - the
-- exposed-plaintext-password problem is permanently closed.

update public.assessments
set data = data - 'managerPassword' - 'employeePassword';
