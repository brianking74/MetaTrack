# Expense Claims Module - Go-Live Runbook

The module is **fully built and code-verified** but ships **disabled** (`EXPENSES_ENABLED = false`)
so staff only see a greyed-out "Expenses - Soon" tab. Follow these steps in order to open it up.

## What was built

| Area | Behaviour |
|---|---|
| Staff portal | New tabs: **Performance Review** (unchanged) + **Expense Claims** (form: type, date, description, amount, one receipt image/PDF; plus "My Claims" list with live status) |
| Manager Hub | Third tab **Expenses**: pending queue with receipt viewer, optional comment, Reject / **Approve & Notify**; review history below |
| Admin dashboard | **Expenses** tab: totals, claims by type, claims by staff member, 12-month trend, full claims table (admin can also approve/reject) |
| Database | `public.expense_claims` table + private `expense-receipts` storage bucket, RLS mirroring the assessments lockdown (staff: own rows only, manager: their team, admin: all, anonymous: nothing) |
| Emails | Netlify Function `expense-notify`: manager notified on submit; staff + finance notified on approve; staff notified on reject |

## Step 1 - Run the database setup (Supabase SQL Editor)

Paste **`supabase/setup_expenses.sql`** into Dashboard -> SQL Editor -> Run.

Verification (paste results back if anything looks off):
- Query A: `rls_enabled = true`, `policy_count = 4`
- Query B: exactly 4 expense policies
- Query C: one bucket, `public = f`, 5 MB limit
- Query D: 3 `receipts %` storage policies

## Step 2 - Deploy the code

Merge the `expense-claims` branch into `main` (Netlify rebuilds automatically).
This merge also ships the full CSV export fix that was pending.

## Step 3 - Flip the flag on

In `constants.ts`, change once, via GitHub web editor:

```
export const EXPENSES_ENABLED = true;
```

(edit -> commit to main -> Netlify rebuilds -> staff tabs become clickable)

## Step 4 - Enable emails (optional but recommended)

1. Create a free account at **resend.com** and generate an API key.
2. Verify your sending domain (e.g. `meta-bev.com`) in Resend -> Domains (adds DNS records);
   until that is done Resend can only deliver to your own account's email address.
3. In Netlify -> Site configuration -> Environment variables, add:
   - `RESEND_API_KEY` = the API key
   - `FINANCE_EMAIL` = the mailbox that should receive "please pay this claim" notices
   - `MAIL_FROM` = `MetaBev Employee Portal <portal@meta-bev.com>` (once domain verified)
4. Redeploy the site (any deploy works - the function reads env at runtime).

Without these variables everything still works; email delivery is simply skipped.

## Notes

- Receipts: PNG / JPG / WEBP / HEIC / PDF, max 5 MB, stored PRIVATELY; opened via
  10-minute signed URLs only by the claimant, their manager, or the admin.
- Staff cannot edit or delete a claim after submitting (database-enforced).
- Expense types live in one list (`EXPENSE_TYPES` in `constants.ts`): currently
  Entertainment (ENT), Travel (TRV), A&P (AP). Send the official full list of
  types + codes and new entries are a 3-line addition.
- The claim form fields were designed without the referenced Excel sheet (it never
  arrived). Send it over and the form can be aligned to match it exactly.
- Amounts are recorded in HKD.
