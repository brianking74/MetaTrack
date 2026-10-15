# Expense Claims Module - Go-Live Runbook

The module is **live** (`EXPENSES_ENABLED = true`, SQL setup done, merged to `main`).
While it is being tested it is in **PILOT MODE**: only staff accounts listed in
`EXPENSES_PILOT_EMAILS` (constants.ts) see the staff "Expense Claims" tab -
it is completely hidden from everyone else. Managers and admins keep their
approval queues and their own "My Expenses" submission tab.

## What was built

| Area | Behaviour |
|---|---|
| Staff portal | Tabs: **Performance Review** (unchanged) + **Expense Claims**: multi-claim form ("Add More" for each extra claim; type, date, description, amount, one receipt image/PDF per claim; running total; "Submit N Claims"), plus "My Claims" list with live status |
| Manager Hub | **Expenses**: pending queue showing ONE review card per claim (a 5-item submission is one card with all items + claim total), receipt viewer, optional comment, Reject / **Approve & Notify** - one click decides the WHOLE claim; **My Expenses**: managers submit their own claims (routed to their manager on file, or the admin) |
| Admin dashboard | **Expenses** tab: totals, claims by type, claims by staff member, 12-month trend, full claims table (admin approve/reject also acts on the whole claim; multi-item rows carry an "N items" chip) |
| Database | `public.expense_claims` table + `claim_group_id` column (all items of one submission share it; run `add_claim_groups.sql`) + private `expense-receipts` storage bucket, RLS mirroring the assessments lockdown (staff: own rows only, manager: their team, admin: all, anonymous: nothing) |
| Emails | Netlify Function `expense-notify`: manager notified ONCE per claim on submit (itemised list + total); staff + finance notified ONCE per claim on approve; staff notified on reject - never one email per line item |

## Claim groups (one submission = one claim)

All lines submitted in one go share a `claim_group_id`, so approving,
rejecting and email notifications work per CLAIM, not per line item:

- Manager approves/rejects the whole claim in one click (all items flip together).
- Finance receives a single itemised email with the claim total.
- The staff approval banner shows the whole claim ("Your claim (3 items) of HK$208.50 ...").

**Deploying this update requires ONE SQL step first** (safe, instant, idempotent -
the app keeps working before and after): run `supabase/add_claim_groups.sql` in the
Supabase SQL Editor, then deploy the new code. Rows submitted before this change
(`claim_group_id` = null) simply behave as their own single-item claim.

## Pilot mode - test account setup

1. **Create the Auth user** (works even after open signups are disabled):
   Supabase Dashboard -> Authentication -> Users -> **Add user -> Create new user**:
   email `test.staff@metabev.com`, a password you remember, tick **Auto Confirm User**.
2. **Add the person to the staff registry** (staff cannot log in without a record,
   and claims need a manager on file): Admin Hub -> **Upload Registry** ->
   `supabase/test-staff-registry.csv` - but first open it and replace
   `Change Me` / `change.me@metabev.com` in the last two columns with the
   manager account that should approve the test claims (claims for an
   unreplaced placeholder can still be approved by the admin in the admin
   Expenses tab, which sees everything).
3. The test email is already in `EXPENSES_PILOT_EMAILS` in `constants.ts`.
   Add any other pilot testers the same way (lowercase, comma-separated).
4. Test flow: log in as the test staff account -> submit one or more claims
   (each with a receipt) -> log in as the approving manager -> approve in the
   Expenses queue -> log back in as the test staff account -> the approval
   banner appears at the top of the Expense Claims tab.
5. **Go-live**: set `EXPENSES_PILOT_EMAILS` to an empty list -
   `export const EXPENSES_PILOT_EMAILS: string[] = [];` - and every staff
   member gets the tab automatically. No other change needed.

## Emails (optional but recommended)

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
