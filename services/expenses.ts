
import { supabase } from './supabase.ts';
import { ExpenseClaim, ExpenseClaimStatus } from '../types.ts';
import { RECEIPT_ACCEPTED_TYPES, RECEIPT_MAX_MB } from '../constants.ts';

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
  receiptPath: row.receipt_path,
  receiptName: row.receipt_name,
  receiptType: row.receipt_type,
  status: row.status as ExpenseClaimStatus,
  claimGroupId: row.claim_group_id || null,
  reviewComment: row.review_comment || '',
  reviewedBy: row.reviewed_by || '',
  reviewedAt: row.reviewed_at || undefined,
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
  receipt_path: c.receiptPath,
  receipt_name: c.receiptName,
  receipt_type: c.receiptType,
  status: c.status,
  claim_group_id: c.claimGroupId || null,
  review_comment: c.reviewComment || null,
  reviewed_by: c.reviewedBy || null,
  reviewed_at: c.reviewedAt || null,
  finance_notified_at: c.financeNotifiedAt || null
});

const networkError = (err: any) =>
  err?.message === 'Failed to fetch'
    ? 'Network Error: Connection to Database failed. Please check if your Supabase project is paused or if you are offline.'
    : (err?.message || 'Unexpected error');

/** Best-effort email dispatch - never blocks or fails the UI action. */
const notifyByEmail = (
  event: 'submitted' | 'approved' | 'rejected',
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
  event: 'submitted' | 'approved' | 'rejected',
  claims: ExpenseClaim[]
): void => {
  if (!claims.length) return;
  const items = claims.map(c => ({
    expenseType: c.expenseType,
    expenseDate: c.expenseDate,
    description: c.description,
    amount: c.amount
  }));
  notifyByEmail(event, claims[0], items, claims.reduce((t, c) => t + c.amount, 0));
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
      total: sorted.reduce((t, c) => t + c.amount, 0),
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
      currency: 'HKD',
      receiptPath,
      receiptName: file.name,
      receiptType: file.type || 'application/octet-stream',
      status: 'submitted',
      claimGroupId: opts?.claimGroupId || null,
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
   * Manager (or admin) approves/rejects a WHOLE claim (all items of one
   * submission) in a single update + a single notification email.
   * A single-claim review is just a group of one.
   */
  async reviewClaims(group: ExpenseClaim[], decision: 'approved' | 'rejected',
                     comment: string, reviewerEmail: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase is not configured.' };
    if (!group.length) return { success: false, error: 'No claims to review.' };
    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from(EXPENSES_TABLE)
        .update({
          status: decision,
          review_comment: comment.trim() || null,
          reviewed_by: reviewerEmail,
          reviewed_at: now,
          finance_notified_at: decision === 'approved' ? now : null
        })
        .in('id', group.map(c => c.id));
      if (error) throw error;
      notifyClaimEvent(decision, group.map(c => ({
        ...c,
        status: decision,
        reviewComment: comment.trim(),
        reviewedBy: reviewerEmail,
        reviewedAt: now,
        financeNotifiedAt: decision === 'approved' ? now : undefined
      })));
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
  }
};
