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

## Adding staff manually (Admin Hub -> "+ Add Staff")

For one-off joiners you no longer need a CSV round-trip. In the Admin Hub press
**"+ Add Staff"** and fill in **Full Name, Email Address, Password and Line
Manager Name**, then press **Add Staff Member**. In one go this:

1. Creates the person's Supabase Auth login (email + password, confirmed, no
   verification email) via the `create-staff` Netlify Function - the secret
   service_role key never touches the browser, and the function checks the
   caller really is the administrator (`admin@metabev.com`) before it does anything.
2. Adds them to the Staff Registry under the named line manager (the same
   mid-year + final records the CSV upload creates), so their manager's hub,
   expense-claim routing and the registry count all pick them up immediately.

The **Line Manager Name** field auto-completes from people already in the
registry; the manager must exist first (add them via CSV or add them here
first). If a login account already exists for the email, the registry entry is
still added and the existing password is left untouched.

**One-time setup (Netlify env vars):**
- `SUPABASE_SERVICE_ROLE_KEY` = the service_role secret (Supabase -> Settings
  -> API). Keep it out of screenshots and never commit it.
- `SUPABASE_URL` (optional - the existing `VITE_SUPABASE_URL` is picked up
  automatically).
- `ADMIN_EMAIL` (optional override, defaults to `admin@metabev.com`).

Then redeploy. Until the key is set, the button returns a clear "not
configured" message and nothing else in the portal changes.

## Company exchange rates (Admin Hub -> "FX Rates")

Staff no longer set the exchange rate themselves - the rate used to convert a
foreign-currency claim into HKD is a **company rate** only the administrator
can change. This removes rate manipulation and keeps every claim consistent.

| Area | Behaviour |
|---|---|
| Admin Hub | New **FX Rates** tab (admin only): one editable rate per currency ("HKD per 1 unit", same definition as the paper form), who last set it and when. **Fetch Latest Rates** prefills every field from open.er-api.com (free daily reference rates, no API key - XE.com's API is a paid product); **Save Rates** stores the reviewed figures |
| Claim form | The exchange-rate field is read-only: "1 USD = 7.848246 HKD - Company rate · set 21 Oct 2026". If a currency has no company rate yet, foreign-currency claims for it are paused with a clear message; HKD claims are unaffected |
| History | The rate is **frozen into each claim at submission** (`fx_rate` + `amount_hkd`), so changing a rate later never rewrites past claims, totals or emails |

**Deploying this update requires ONE SQL step first** (safe, instant, idempotent -
the app keeps working before and after): run `supabase/add_fx_rates.sql` in the
Supabase SQL Editor. It creates `public.expense_fx_rates` (RLS: everyone
signed-in reads, ONLY `admin@metabev.com` writes) and seeds all 12 claim
currencies with 21 Oct 2026 reference rates, flagged as "company default -
review please". Re-running the script never overwrites a rate you have saved.

Suggested routine: press **Fetch Latest Rates**, sanity-check the prefilled
market rates (they carry no company margin), adjust to finance policy if
needed, press **Save Rates** - e.g. weekly or whenever a big currency move
makes totals look off.

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

## Expense Dashboard (manager hub)

A "Dashboard" tab in the Manager Hub shows selected managers the running
totals of ALL expense claims, with filters for staff, expense type and
status, plus breakdowns by type, by staff and a 6-month trend.

Access is allowlist-based, stored IN THE DATABASE (not in app code):

1. Run `add_dashboard.sql` in the Supabase SQL Editor (idempotent).
   - Creates `expense_dashboard_viewers` (email allowlist)
   - Creates `is_expense_dashboard_viewer()` (security definer check)
   - Adds a permissive SELECT policy so viewers + admins read all claims
   - Seeds one example viewer - EDIT the seed list before running
2. Manage viewers any time:
   - Add:    `insert into expense_dashboard_viewers (email) values ('manager@metabev.com') on conflict do nothing;`
   - Remove: `delete from expense_dashboard_viewers where email = '...';`
3. Managers NOT on the list see a polite "no access" card; the allowlist
   itself never leaves the database (checked via an RPC, RLS-enforced).

Admins always see all claims (existing admin Expenses tab + analytics).

## Two-Stage Approval: line manager -> General Manager

Every expense claim now needs TWO approvals before it is paid:

1. **Line manager** approves the claim as before.
2. The claim moves to **pending_gm** and the **General Manager**
   (currently sophian@meta-bev.com) is emailed to give the FINAL approval.
   She sees a dedicated "GM Approvals" tab in the Manager Hub.
3. GM approves  -> staff are told the claim is approved and that
   "Expense claims will be paid within 30 days." Finance is emailed to pay.
   GM rejects   -> staff are asked to resubmit an amended claim.

### To switch it on (ORDER MATTERS - database first)

1. Run `add_gm_stage.sql` in the Supabase SQL Editor (idempotent):
   - adds gm_email / gm_comment / manager_reviewed_by / manager_reviewed_at
   - backfills gm_email on existing rows
   - widens the status check to allow 'pending_gm'
   - rewrites the RLS policies so the GM sees + reviews their queue
   - lets the GM open claim receipts
2. Deploy the app update (netlify picks it up from GitHub automatically).
3. Make sure sophian@meta-bev.com can sign in: the account must exist in
   Supabase Auth (same as other managers - see import-users.mjs). She logs
   in through the MANAGER login on the portal; the "GM Approvals" tab
   appears only for her.

### Changing the GM later

The GM address lives in two places - update both together:
- app:  `EXPENSE_GM_EMAIL` in constants.ts (stamped onto new claims)
- db:   the literal in add_gm_stage.sql section 2 (for existing rows),
  e.g. `update expense_claims set gm_email = 'new@meta-bev.com' where gm_email = 'old@meta-bev.com';`

### Emails

The Netlify function expense-notify sends one email per claim event:
submitted -> line manager, gm_approval -> GM, approved -> staff + finance,
rejected -> staff. Still requires RESEND_API_KEY and FINANCE_EMAIL in the
Netlify environment variables (see top of this runbook).
