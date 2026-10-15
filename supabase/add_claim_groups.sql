-- ============================================================
-- EXPENSE CLAIM GROUPS: one submission = one claim with N items
-- ============================================================
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Run this BEFORE deploying the app update that uses claim groups.
-- IDEMPOTENT: safe to run multiple times, takes effect instantly, and
-- does not touch any existing rows or policies.
--
-- Background: the "Add More" form stores each line as its own
-- expense_claims row. All rows submitted together now share one
-- claim_group_id so that:
--   - the manager approves/rejects the WHOLE claim in one click
--   - finance receives ONE itemised email per claim (not per item)
--   - the staff member sees one approval notice for the whole claim
--
-- No RLS changes are needed: row policies apply to the new column
-- automatically. Rows submitted before this change have claim_group_id
-- = NULL and keep working - each simply behaves as its own claim.

-- 1) Add the nullable group column
alter table public.expense_claims
  add column if not exists claim_group_id uuid;

-- 2) Lookup index for grouped reads/updates
create index if not exists expense_claims_group_idx
  on public.expense_claims (claim_group_id);

-- ------------------------------------------------------------
-- Verification - must return exactly one row: claim_group_id | uuid
-- ------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'expense_claims'
  and column_name = 'claim_group_id';
