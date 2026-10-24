
import { supabase } from './supabase.ts';
import { ExpenseClaim, ExpenseClaimStatus } from '../types.ts';
import { RECEIPT_ACCEPTED_TYPES, RECEIPT_MAX_MB, EXPENSE_CURRENCY, EXPENSE_GM_EMAIL, claimHkd } from '../constants.ts';

// ============================================================
// Expense Claims service
// ============================================================
// DB table : public.expense_claims   (RLS-protected, see setup_expenses.sql)
// Storage  : bucket 'expense-receipts' (private, signed-URL access)
// Emails   : fire-and-forget POST to the Netlify Function
//            /.netlify/functions/expense-notify (no-op unless the site has
//            RESEND_API_KEY configured - see supabase/EXPENSES_RUNBOOK.md)

const EXPENSES_TABLE = 'expense_claims';
const RECEIPT_BUCKET = 'expense-receipts';

const mapClaim = (row: any): ExpenseClaim => ({
  id: row.id,
  email: row.email,
  staffName: row.staff_name,
  managerEmail: row.manager_email,
  managerName: row.manager_name || '',
  expenseType: row.expense_type,
  expenseDate: row.expense_date,
  description: row.description,
  amount: Number(row.amount),
  currency: row.currency || 'HKD',
  fxRate: row.fx_rate != null ? Number(row.fx_rate) : 1,
  amountHkd: row.amount_hkd != null ? Number(row.amount_hkd) : undefined,
  customerName: row.customer_name || '',
  budgetCode: row.budget_code || '',
  receiptPath: row.receipt_path,
  receiptName: row.receipt_name,
  receiptType: row.receipt_type,
  status: row.status as ExpenseClaimStatus,
  claimGroupId: row.claim_group_id || null,
  gmEmail: row.gm_email || '',
  reviewComment: row.review_comment || '',
  gmComment: row.gm_comment || '',
  reviewedBy: row.reviewed_by || '',
  reviewedAt: row.reviewed_at || undefined,
  managerReviewedBy: row.manager_reviewed_by || '',
  managerReviewedAt: row.manager_reviewed_at || undefined,
  financeNotifiedAt: row.finance_notified_at || undefined,
  createdAt: row.created_at,
});

const mapClaimToRow = (c: ExpenseClaim) => ({
  id: c.id,
  email: c.email.toLowerCase().trim(),
  staff_name: c.staffName,
  manager_email: c.managerEmail.toLowerCase().trim(),
  manager_name: c.managerName || '',
  expense_type: c.expenseType,
  expense_date: c.expenseDate,
  description: c.description,
  amount: c.amount,
  currency: c.currency,
  fx_rate: c.fxRate ?? 1,
  amount_hkd: c.amountHkd ?? c.amount,
  customer_name: c.customerName?.trim() || null,
  budget_code: c.budgetCode?.trim() || null,
  receipt_path: c.receiptPath,
  receipt_name: c.receiptName,
  receipt_type: c.receiptType,
  status: c.status,
  claim_group_id: c.claimGroupId || null,
  gm_email: (c.gmEmail || EXPENSE_GM_EMAIL).toLowerCase().trim(),
  review_comment: c.reviewComment || null,
  gm_comment: c.gmComment || null,
  reviewed_by: c.reviewedBy || null,
  reviewed_at: c.reviewedAt || null,
  manager_reviewed_by: c.managerReviewedBy || null,
  manager_reviewed_at: c.managerReviewedAt || null,
  finance_notified_at: c.financeNotifiedAt || null
});

const networkError = (err: any) =>
  err?.message === 'Failed to fetch'
    ? 'Network Error: Connection to Database failed. Please check if your Supabase project is paused or if you are offline.'
    : (err?.message || 'Unexpected error');

/** Best-effort email dispatch - never blocks or fails the UI action. */
const notifyByEmail = (
  event: 'submitted' | 'gm_approval' | 'approved' | 'rejected',
  claim: ExpenseClaim,
  items?: Pick<ExpenseClaim, 'expenseType' | 'expenseDate' | 'description' | 'amount'>[],
  total?: number
): void => {
  try {
    fetch('/.netlify/functions/expense-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        claim,
        ...(items && items.length ? { items, total } : {})
      })
    }).catch(() => { /* email is optional; in-app status always works */ });
  } catch { /* ignore */ }
};

/**
 * ONE email for a WHOLE claim (a submission group), not one per item.
 * The first claim carries the staff/manager identity; all lines are
 * attached as an itemised list with the claim total.
 */
export const notifyClaimEvent = (
  event: 'submitted' | 'gm_approval' | 'approved' | 'rejected',
  claims: ExpenseClaim[]
): void => {
  if (!claims.length) return;
  const items = claims.map(c => ({
    expenseType: c.expenseType,
    expenseDate: c.expenseDate,
    description: c.description,
    amount: c.amount,
    currency: c.currency,
    fxRate: c.fxRate,
    amountHkd: c.amountHkd,
    customerName: c.customerName,
    budgetCode: c.budgetCode
  }));
  notifyByEmail(event, claims[0], items, claims.reduce((t, c) => t + claimHkd(c), 0));
};

// ============================================================
// Claim groups: one submission = one claim with N items
// ============================================================
// All rows submitted in the same batch share a claim_group_id. Legacy rows
// (pre-group) have null and stand alone - their key is unique per row.

export const claimGroupKey = (c: ExpenseClaim): string => c.claimGroupId || `row-${c.id}`;

export interface ClaimGroup {
  key: string;
  claims: ExpenseClaim[];   // oldest first within the claim
  total: number;
  submittedAt: string;      // newest createdAt in the claim
}

/** One row of public.expense_budget - the GM's annual budget (add_budget.sql). */
export interface AnnualBudget {
  year: number;
  amount: number;
  updatedBy?: string;
  updatedAt?: string;
}

/** Groups claims into whole claims (submissions), newest claim first. */
export const groupClaims = (claims: ExpenseClaim[]): ClaimGroup[] => {
  const map = new Map<string, ExpenseClaim[]>();
  for (const c of claims) {
    const k = claimGroupKey(c);
    const list = map.get(k);
    if (list) list.push(c); else map.set(k, [c]);
  }
  const groups: ClaimGroup[] = [];
  map.forEach(list => {
    const sorted = [...list].sort((a, b) => ((a.createdAt || '') < (b.createdAt || '') ? -1 : 1));
    groups.push({
      key: claimGroupKey(sorted[0]),
      claims: sorted,
      total: sorted.reduce((t, c) => t + claimHkd(c), 0),
      submittedAt: sorted.reduce((m, c) => ((c.createdAt || '') > m ? (c.createdAt || '') : m), sorted[0].createdAt || '')
    });
  });
  return groups.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
};

/** One group id shared by every line of a batch submission. */
export const newClaimGroupId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Validates a receipt file before any upload is attempted. */
export const validateReceiptFile = (file: File): string | null => {
  if (file.size > RECEIPT_MAX_MB * 1024 * 1024) {
    return `Receipt is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${RECEIPT_MAX_MB} MB.`;
  }
  const mime = (file.type || '').toLowerCase();
  // Some browsers report an empty type for HEIC - allow it through and let
  // the storage bucket have the final say.
  if (mime && !RECEIPT_ACCEPTED_TYPES.includes(mime)) {
    return 'Receipt must be an image (PNG, JPG, WEBP, HEIC) or a PDF.';
  }
  return null;
};

export const expensesService = {
  /**
   * Uploads the receipt, then inserts the claim. The claim id is generated
   * client-side so the storage path can be built before the insert.
   * If the insert fails, the uploaded receipt is removed again (no orphans).
   */
  async submitClaim(input: {
    staffName: string;
    email: string;
    managerEmail: string;
    managerName?: string;
    expenseType: string;
    expenseDate: string;
    description: string;
    amount: number;
    currency?: string;      // default HKD
    fxRate?: number;        // HKD per 1 unit of currency; forced to 1 for HKD
    customerName?: string;
    budgetCode?: string;
  }, file: File, opts?: {
    claimGroupId?: string;  // shared id linking all lines of one submission
    notify?: boolean;       // default true; batch submissions notify once at the end
  }): Promise<{ success: boolean; error?: string; claim?: ExpenseClaim }> {
    if (!supabase) return { success: false, error: 'Supabase is not configured.' };

    const email = input.email.toLowerCase().trim();
    const managerEmail = input.managerEmail.toLowerCase().trim();
    if (!managerEmail || !managerEmail.includes('@')) {
      return { success: false, error: 'No manager is on file for your account. Please contact your administrator.' };
    }

    const fileError = validateReceiptFile(file);
    if (fileError) return { success: false, error: fileError };

    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const claimId = uuid;
    const safeName = file.name.replace(/[^\w.\- ]+/g, '_').slice(-80) || 'receipt';
    const receiptPath = `${email}/${claimId}/${safeName}`;

    // 1) Upload receipt into the claimant's own folder
    const { error: uploadError } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(receiptPath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (uploadError) {
      const msg = uploadError.message?.includes('size')
        ? `Receipt upload failed: file exceeds the ${RECEIPT_MAX_MB} MB limit.`
        : `Receipt upload failed: ${uploadError.message}`;
      return { success: false, error: msg };
    }

    // 2) Insert the claim row (RLS requires email = own, status = 'submitted')
    // Currency + FX: HKD claims are always rate 1. Foreign claims carry
    // the entered rate; amountHkd (the HKD reporting value every total
    // sums) is fixed at submission time so later rate changes cannot
    // rewrite history.
    const currency = (input.currency || EXPENSE_CURRENCY).toUpperCase();
    const fxRate = currency === 'HKD'
      ? 1
      : (input.fxRate && input.fxRate > 0 ? input.fxRate : 1);
    const amountHkd = Math.round(input.amount * fxRate * 100) / 100;

    const claim: ExpenseClaim = {
      id: claimId,
      email,
      staffName: input.staffName,
      managerEmail,
      managerName: input.managerName || '',
      expenseType: input.expenseType,
      expenseDate: input.expenseDate,
      description: input.description.trim(),
      amount: input.amount,
      currency,
      fxRate,
      amountHkd,
      customerName: input.customerName?.trim() || '',
      budgetCode: input.budgetCode?.trim() || '',
      receiptPath,
      receiptName: file.name,
      receiptType: file.type || 'application/octet-stream',
      status: 'submitted',
      claimGroupId: opts?.claimGroupId || null,
      gmEmail: EXPENSE_GM_EMAIL,
      createdAt: new Date().toISOString()
    };

    const { error: insertError } = await supabase
      .from(EXPENSES_TABLE)
      .insert(mapClaimToRow(claim));
    if (insertError) {
      // Clean up the orphan receipt so storage doesn't accumulate junk
      supabase.storage.from(RECEIPT_BUCKET).remove([receiptPath]).catch?.(() => {});
      return { success: false, error: insertError.message };
    }

    if (opts?.notify !== false) notifyByEmail('submitted', claim);
    return { success: true, claim };
  },

  /** All claims the signed-in user may see (RLS decides). */
  async getClaims(): Promise<{ data: ExpenseClaim[]; error?: string }> {
    if (!supabase) return { data: [], error: 'Supabase is not configured.' };
    try {
      const { data, error } = await supabase
        .from(EXPENSES_TABLE)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data: (data || []).map(mapClaim) };
    } catch (err: any) {
      return { data: [], error: networkError(err) };
    }
  },

  /**
   * TWO-STAGE review of a WHOLE claim (all items of one submission) in a
   * single update + a single notification email.
   *
   * stage 'manager' (line manager, claim status = 'submitted'):
   *   - approved  -> status 'pending_gm': the claim moves to the General
   *                  Manager's queue and the GM is notified by email.
   *   - rejected  -> status 'rejected': staff are asked to resubmit an
   *                  amended claim.
   *
   * stage 'gm' (General Manager, claim status = 'pending_gm'):
   *   - approved  -> status 'approved': FINAL approval. Staff are told the
   *                  claim will be paid within 30 days and finance is
   *                  notified to pay it.
   *   - rejected  -> status 'rejected': staff resubmit an amended claim.
   *
   * A single-claim review is just a group of one.
   */
  async reviewClaims(group: ExpenseClaim[], decision: 'approved' | 'rejected',
                     comment: string, reviewerEmail: string,
                     stage: 'manager' | 'gm' = 'manager'): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase is not configured.' };
    if (!group.length) return { success: false, error: 'No claims to review.' };

    // Stage guard: every row must still be sitting at the expected stage so
    // a stale browser cannot double-review a claim that already moved on.
    const expected = stage === 'manager' ? 'submitted' : 'pending_gm';
    if (group.some(c => c.status !== expected)) {
      return {
        success: false,
        error: stage === 'manager'
          ? 'This claim has already been reviewed. Please refresh the page.'
          : 'This claim is no longer awaiting GM approval. Please refresh the page.'
      };
    }

    const now = new Date().toISOString();
    const trimmed = comment.trim();

    // Stage 1 (line manager) approval keeps the claim moving: the manager's
    // comment goes into review_comment (stage-1 comment) and the audit
    // fields record WHO approved. reviewed_by/at stay untouched until the
    // FINAL decision so the history always shows the last decision maker.
    const isStage1Approval = stage === 'manager' && decision === 'approved';
    const updates = isStage1Approval
      ? {
          status: 'pending_gm' as ExpenseClaimStatus,
          review_comment: trimmed || null,
          gm_comment: null,
          manager_reviewed_by: reviewerEmail,
          manager_reviewed_at: now,
          finance_notified_at: null
        }
      : {
          status: decision as ExpenseClaimStatus,
          review_comment: stage === 'gm' ? group[0].reviewComment || null : (trimmed || null),
          gm_comment: stage === 'gm' ? (trimmed || null) : null,
          reviewed_by: reviewerEmail,
          reviewed_at: now,
          manager_reviewed_by: stage === 'manager' ? reviewerEmail : group[0].managerReviewedBy || null,
          manager_reviewed_at: stage === 'manager' ? now : group[0].managerReviewedAt || null,
          finance_notified_at: decision === 'approved' ? now : null
        };

    try {
      const { error } = await supabase
        .from(EXPENSES_TABLE)
        .update(updates)
        .in('id', group.map(c => c.id));
      if (error) throw error;

      const updated = group.map(c => ({
        ...c,
        status: updates.status,
        reviewComment: updates.review_comment || '',
        gmComment: updates.gm_comment || '',
        reviewedBy: updates.reviewed_by || '',
        reviewedAt: updates.reviewed_at || undefined,
        managerReviewedBy: updates.manager_reviewed_by || '',
        managerReviewedAt: updates.manager_reviewed_at || undefined,
        financeNotifiedAt: updates.finance_notified_at || undefined
      }));

      // ONE notification per claim, matched to where the claim now sits.
      notifyClaimEvent(
        isStage1Approval ? 'gm_approval' : decision,
        updated
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: networkError(err) };
    }
  },

  /** Short-lived signed URL so manager/admin/staff can open the receipt. */
  async getReceiptUrl(claim: ExpenseClaim): Promise<{ url?: string; error?: string }> {
    if (!supabase) return { error: 'Supabase is not configured.' };
    const { data, error } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(claim.receiptPath, 600); // valid 10 minutes
    if (error || !data) return { error: error?.message || 'Could not open the receipt.' };
    return { url: data.signedUrl };
  },

  /** Admin-only: delete a claim row and its receipt. */
  async deleteClaim(claim: ExpenseClaim): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase is not configured.' };
    const { error } = await supabase.from(EXPENSES_TABLE).delete().eq('id', claim.id);
    if (error) return { success: false, error: error.message };
    supabase.storage.from(RECEIPT_BUCKET).remove([claim.receiptPath]).catch?.(() => {});
    return { success: true };
  },

  /**
   * True when the signed-in user is on the expense-dashboard allowlist
   * (expense_dashboard_viewers, checked by an RPC so the list itself
   * never leaves the database). configured=false means the SQL setup
   * script (supabase/add_dashboard.sql) has not been run yet.
   */
  async isDashboardViewer(): Promise<{ viewer: boolean; configured: boolean }> {
    if (!supabase) return { viewer: false, configured: false };
    try {
      const { data, error } = await supabase.rpc('is_expense_dashboard_viewer');
      if (error) return { viewer: false, configured: false };
      return { viewer: data === true, configured: true };
    } catch {
      return { viewer: false, configured: false };
    }
  },

  /**
   * The GM-controlled annual budget (public.expense_budget, see
   * supabase/add_budget.sql). tableMissing=true means that SQL has not
   * been run yet - the dashboard hides the budget panel in that case, so
   * the app can ship before the migration (zero-downtime rollout, same
   * pattern as the FX rates table).
   */
  async getAnnualBudget(year: number): Promise<{ data: AnnualBudget | null; tableMissing?: boolean; error?: string }> {
    if (!supabase) return { data: null, tableMissing: true };
    try {
      const { data, error } = await supabase
        .from('expense_budget')
        .select('budget_year, amount, updated_by, updated_at')
        .eq('budget_year', year)
        .maybeSingle();
      if (error) {
        const msg = error.message || '';
        if ((error as any).code === 'PGRST205' || /schema cache|does not exist/i.test(msg)) {
          return { data: null, tableMissing: true };
        }
        return { data: null, error: networkError(error) };
      }
      if (!data) return { data: null };
      return {
        data: {
          year: Number(data.budget_year),
          amount: Number(data.amount),
          updatedBy: data.updated_by || '',
          updatedAt: data.updated_at || undefined
        }
      };
    } catch (err: any) {
      return { data: null, error: networkError(err) };
    }
  },

  /**
   * Save the annual budget. RLS allows ONLY the General Manager
   * (sophian@meta-bev.com, mirrored from EXPENSE_GM_EMAIL) to write;
   * anyone else gets a permission error back from the database.
   */
  async saveAnnualBudget(year: number, amount: number, savedBy: string): Promise<{ success: boolean; tableMissing?: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase is not configured.' };
    try {
      const { error } = await supabase
        .from('expense_budget')
        .upsert({
          budget_year: year,
          amount: Math.round(amount * 100) / 100,
          updated_by: savedBy.toLowerCase().trim(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'budget_year' });
      if (error) {
        const msg = error.message || '';
        if ((error as any).code === 'PGRST205' || /schema cache|does not exist/i.test(msg)) {
          return { success: false, tableMissing: true, error: 'The budget table is not set up yet. Ask the administrator to run supabase/add_budget.sql.' };
        }
        return { success: false, error: networkError(error) };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: networkError(err) };
    }
  }
};
