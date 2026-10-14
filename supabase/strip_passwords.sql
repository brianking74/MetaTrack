-- ============================================================
-- STAGE 2 (cleanup): Remove plaintext passwords from data rows
-- ============================================================
-- PREREQUISITES (both already verified):
--   1. supabase/import-users.mjs created Auth accounts (52/52 done)
--   2. Supabase Auth logins deployed and verified for staff/manager/admin
--
-- Idempotent: safe to run multiple times (removing an already-missing
-- key is a no-op).
--
-- RECOMMENDED BEFORE RUNNING: in the app as admin, Staff Registry tab
-- -> "System Backup" to download a JSON snapshot (your only undo path).
-- NOTE: that backup file contains the old passwords - store it privately
-- and delete it once everything is confirmed stable.
--
-- The app itself already strips these fields on every write
-- (stripSecrets in services/supabase.ts), so they cannot come back.

-- 1) BEFORE: how many rows still carry plaintext passwords?
select count(*) as rows_with_passwords_before
from public.assessments
where data ? 'managerPassword' or data ? 'employeePassword';

-- 2) Strip them (top-level keys on the data JSONB)
update public.assessments
set data = data - 'managerPassword' - 'employeePassword';

-- 3) AFTER: must show 0
select count(*) as rows_with_passwords_after
from public.assessments
where data ? 'managerPassword' or data ? 'employeePassword';

-- 4) Deep sweep: must return NO ROWS - no password-like string anywhere
--    in any record (top-level or nested). If it returns rows, inspect
--    them: they may just be the word "password" in someone's comments.
select id, email
from public.assessments
where data::text ilike '%password%'
limit 10;
