-- ============================================================
-- EXPENSE CLAIMS: table, RLS, private receipt storage bucket
-- ============================================================
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- IDEMPOTENT: safe to run multiple times (drops and recreates policies).
--
-- Re-uses the two helper functions created by secure_rls.sql:
--   public.auth_email()  -> the signed-in user's lowercase email
--   public.is_admin()    -> true only for admin@metabev.com
--
-- Access model (mirrors the assessments table):
--   staff    : submit claims under their own email, read their own claims
--   manager  : read claims they manage, approve/reject them
--   admin    : read everything, approve/reject, delete
--   anonymous: nothing at all
--
-- Receipts live in a PRIVATE storage bucket 'expense-receipts':
--   path format: <staff email>/<claim id>/<original filename>
--   staff upload only into their own folder; managers/admin read via
--   signed URLs; anonymous cannot access the bucket in any way.

-- ------------------------------------------------------------
-- 1) Table
-- ------------------------------------------------------------
create table if not exists public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  email text not null,                      -- claimant (staff) email, lowercase
  staff_name text not null,
  manager_email text not null,              -- approver email, lowercase
  manager_name text,
  expense_type text not null,               -- code: ENT | TRV | AP (extendable)
  expense_date date not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'HKD',
  receipt_path text not null,               -- storage path (see header)
  receipt_name text not null,               -- original filename
  receipt_type text not null,               -- mime type
  status text not null default 'submitted'
    check (status in ('submitted','approved','rejected')),
  claim_group_id uuid,                      -- links all items of one submission
  review_comment text,
  reviewed_by text,
  reviewed_at timestamptz,
  finance_notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists expense_claims_email_idx
  on public.expense_claims (lower(email));
create index if not exists expense_claims_manager_idx
  on public.expense_claims (lower(manager_email), status);
create index if not exists expense_claims_status_idx
  on public.expense_claims (status, created_at desc);
create index if not exists expense_claims_group_idx
  on public.expense_claims (claim_group_id);

-- ------------------------------------------------------------
-- 2) Row Level Security: ON
-- ------------------------------------------------------------
alter table public.expense_claims enable row level security;

-- ------------------------------------------------------------
-- 3) Table policies (wipe + recreate = idempotent, same
--    technique that fixed the assessments leak)
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'expense_claims'
  loop
    raise notice 'dropping policy: %', r.policyname;
    execute format('drop policy if exists %I on public.expense_claims', r.policyname);
  end loop;
end $$;

-- staff read their own claims, managers read their team's, admin reads all
create policy "expenses select own or managed or admin"
on public.expense_claims
for select
using (
  lower(email) = public.auth_email()
  or lower(manager_email) = public.auth_email()
  or public.is_admin()
);

-- only the claimant can submit, and always with status 'submitted'
-- (staff can never forge an already-approved row)
create policy "expenses insert own"
on public.expense_claims
for insert
with check (
  lower(email) = public.auth_email()
  and status = 'submitted'
);

-- only the manager (or admin) can approve/reject - staff cannot edit
-- a claim once submitted
create policy "expenses review by manager or admin"
on public.expense_claims
for update
using (
  lower(manager_email) = public.auth_email()
  or public.is_admin()
)
with check (
  lower(manager_email) = public.auth_email()
  or public.is_admin()
);

-- only the administrator may delete claims
create policy "expenses delete admin only"
on public.expense_claims
for delete
using (public.is_admin());

-- ------------------------------------------------------------
-- 4) Private receipt storage bucket (5 MB, images + PDF)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,                                   -- PRIVATE: signed URLs only
  5242880,                                 -- 5 MB
  array['image/png','image/jpeg','image/webp','image/heic','image/heif','application/pdf']
)
on conflict (id) do update
  set file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------
-- 5) Storage policies (only ours, identified by the 'receipts ' prefix)
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'receipts %'
  loop
    raise notice 'dropping storage policy: %', r.policyname;
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- uploads only into the uploader's own folder: <email>/<claim id>/<file>
create policy "receipts upload own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = public.auth_email()
);

-- read: your own folder, or you manage/administer the claim the receipt
-- belongs to (managers/admin open receipts via short-lived signed URLs)
create policy "receipts read participants"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'expense-receipts'
  and (
    (storage.foldername(name))[1] = public.auth_email()
    or exists (
      select 1 from public.expense_claims c
      where c.receipt_path = name
        and (lower(c.manager_email) = public.auth_email() or public.is_admin())
    )
  )
);

-- receipt cleanup only by admin (e.g. when deleting a claim)
create policy "receipts delete admin only"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'expense-receipts'
  and public.is_admin()
);

-- ------------------------------------------------------------
-- 6) Verification - paste the results back for confirmation
-- ------------------------------------------------------------
-- Query A: must show rls_enabled = true and policy_count = 4
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'expense_claims') as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'expense_claims';

-- Query B: must list EXACTLY these four policies
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'expense_claims'
order by policyname;

-- Query C: must show one bucket, public = f, 5 MB limit
select id, public, file_size_limit from storage.buckets
where id = 'expense-receipts';

-- Query D: must list the three receipt policies
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like 'receipts %'
order by policyname;
