
import React, { useState, useEffect, useRef } from 'react';
import { ExpenseClaim } from '../types.ts';
import { expensesService, validateReceiptFile, newClaimGroupId, notifyClaimEvent, claimGroupKey } from '../services/expenses.ts';
import { EXPENSE_TYPES, EXPENSE_CURRENCIES, expenseTypeLabel, formatMoney, claimHkd, isForeignCurrency, fxRateText, PAYMENT_TERMS_TEXT } from '../constants.ts';
import { fxRatesService, CompanyRates } from '../services/fx.ts';
import ClaimAmount from './ClaimAmount.tsx';

interface ExpenseClaimsProps {
  staffName: string;
  staffEmail: string;
  managerEmail: string;
  managerName?: string;
}

const SEEN_KEY = 'metabev-expense-seen-at';

// One entry in the multi-claim form. Each line becomes its own claim row
// (with its own receipt) when the batch is submitted.
interface ClaimLine {
  key: string;
  expenseType: string;
  expenseDate: string;
  description: string;
  amount: string;
  currency: string;      // EXPENSE_CURRENCIES code, default HKD
  fxRate: string;        // mirror of the company rate (manual entry only until the rates table exists)
  customerName: string;  // optional customer / client
  budgetCode: string;    // optional brand budget code, e.g. EST008
  file: File | null;
}

// Safety cap so nobody submits an unbounded batch in one go.
const MAX_CLAIM_LINES = 10;

const makeLineKey = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// A new blank line. When "Add More" is pressed we copy the type, date,
// currency and customer/budget details from the last line - most multi-claim
// batches happen on the same day, same trip, same customer.
const makeLine = (copyFrom?: ClaimLine): ClaimLine => ({
  key: makeLineKey(),
  expenseType: copyFrom?.expenseType || EXPENSE_TYPES[0]?.code || '',
  expenseDate: copyFrom?.expenseDate || new Date().toISOString().split('T')[0],
  description: '',
  amount: '',
  currency: copyFrom?.currency || 'HKD',
  fxRate: copyFrom?.fxRate || '1',
  customerName: copyFrom?.customerName || '',
  budgetCode: copyFrom?.budgetCode || '',
  file: null,
});

const StatusChip: React.FC<{ claim: ExpenseClaim }> = ({ claim }) => {
  const map: Record<string, { text: string; classes: string }> = {
    submitted:  { text: 'Pending Approval',       classes: 'bg-blue-50 text-blue-700 border-blue-200' },
    pending_gm: { text: 'Approved · Awaiting GM', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved:   { text: 'Approved',               classes: 'bg-green-50 text-green-700 border-green-200' },
    rejected:   { text: 'Not Approved',           classes: 'bg-red-50 text-red-700 border-red-200' }
  };
  const s = map[claim.status] || map.submitted;
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${s.classes}`}>
      {s.text}
    </span>
  );
};

const ExpenseClaims: React.FC<ExpenseClaimsProps> = ({ staffName, staffEmail, managerEmail, managerName }) => {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // --- Multi-claim form state ---
  const [lines, setLines] = useState<ClaimLine[]>(() => [makeLine()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<{ current: number; total: number } | null>(null);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [reviewNotice, setReviewNotice] = useState<{ claims: ExpenseClaim[] } | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // --- Company FX rates (admin-controlled) ---
  // Staff can no longer type an exchange rate: every claim uses the
  // company rate set in the Admin Hub (FX Rates tab). companyRates stays
  // null until the rates table exists (SQL not run yet) or cannot be
  // loaded - in those cases the form falls back to the old manual rate
  // input so nothing breaks during rollout.
  const [companyRates, setCompanyRates] = useState<CompanyRates | null>(null);
  const [ratesTableMissing, setRatesTableMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fxRatesService.getRates().then(({ rates, tableMissing }) => {
      if (cancelled) return;
      if (tableMissing) setRatesTableMissing(true);
      else setCompanyRates(rates || {});
    });
    return () => { cancelled = true; };
  }, []);

  // Keep every line's displayed rate in step with the company rates once
  // they load (or when the administrator updates them mid-session).
  useEffect(() => {
    if (!companyRates) return;
    setLines(prev => prev.map(l =>
      isForeignCurrency(l.currency) && companyRates[l.currency]
        ? { ...l, fxRate: String(companyRates[l.currency].rate) }
        : l
    ));
  }, [companyRates]);

  const hasManager = !!managerEmail && managerEmail.includes('@');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      const { data, error } = await expensesService.getClaims();
      if (cancelled) return;
      if (error) setLoadError(error);
      // Managers reuse this component for their OWN claims (My Expenses tab):
      // RLS also returns the team claims they approve, so scope strictly to
      // the signed-in email. For staff, RLS already returns only their own.
      const own = data.filter(c => (c.email || '').toLowerCase() === staffEmail.toLowerCase());
      setClaims(own);
      setIsLoading(false);

      // Approval/rejection notice: surface the most recent review outcome the
      // staff member has not seen yet (acknowledged in THIS browser via
      // localStorage). A claim group is reviewed in one action, so all its
      // items share the exact same reviewed_at - we show the whole claim.
      const reviewed = own.filter(c => c.reviewedAt);
      if (reviewed.length > 0) {
        let lastSeen = '';
        try { lastSeen = localStorage.getItem(SEEN_KEY) || ''; } catch { /* ignore */ }
        const newest = reviewed.map(c => c.reviewedAt!).sort().reverse()[0];
        if (!lastSeen || newest > lastSeen) {
          const batch = reviewed.filter(c => c.reviewedAt === newest);
          setReviewNotice({ claims: batch });
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const dismissNotice = () => {
    if (!reviewNotice) return;
    const newest = reviewNotice.claims.map(c => c.reviewedAt || '').sort().reverse()[0];
    try { localStorage.setItem(SEEN_KEY, newest); } catch { /* ignore */ }
    setReviewNotice(null);
  };

  // --- Line editing helpers ---
  const updateLine = (key: string, patch: Partial<ClaimLine>) => {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    setFormError('');
    setLines(prev => (prev.length >= MAX_CLAIM_LINES ? prev : [...prev, makeLine(prev[prev.length - 1])]));
  };

  const removeLine = (key: string) => {
    setFormError('');
    setLines(prev => (prev.length <= 1 ? prev : prev.filter(l => l.key !== key)));
    delete fileInputRefs.current[key];
  };

  const handleLineFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFormError('');
    if (f) {
      const validation = validateReceiptFile(f);
      if (validation) {
        setFormError(validation);
        e.target.value = '';
        updateLine(key, { file: null });
        return;
      }
    }
    updateLine(key, { file: f });
  };

  /** The exchange rate a line can use: the company rate set in the Admin
   *  Hub when available, otherwise (rates table missing / unreachable)
   *  the manually entered one - the pre-rates behaviour. Null = no valid
   *  rate yet, which blocks submission for foreign-currency lines. */
  const rateForLine = (l: ClaimLine): number | null => {
    if (!isForeignCurrency(l.currency)) return 1;
    if (companyRates) {
      const info = companyRates[l.currency];
      return info && info.rate > 0 ? info.rate : null;
    }
    const manual = parseFloat(l.fxRate);
    return manual > 0 ? manual : null;
  };

  /** Friendly "set <date>" for a company rate, e.g. "21 Oct 2026". */
  const rateSetDate = (currency: string): string => {
    const info = companyRates?.[currency];
    if (!info?.updatedAt) return '';
    try {
      return new Date(info.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  /** HKD value of a form line (amount x fx rate for foreign currency). */
  const lineHkd = (l: ClaimLine): number => {
    const amt = parseFloat(l.amount) || 0;
    const rate = rateForLine(l);
    if (rate == null) return 0;
    return Math.round(amt * rate * 100) / 100;
  };

  /** Returns the first problem found across all lines, with its line number. */
  const validateLines = (): string | null => {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const label = lines.length > 1 ? `Claim ${i + 1}: ` : '';
      if (!l.expenseType) return `${label}please choose an expense type.`;
      if (!l.expenseDate) return `${label}please choose the date of the expense.`;
      if (!l.description.trim()) return `${label}please describe the expense (what it was for).`;
      const amt = parseFloat(l.amount);
      if (!amt || amt <= 0) return `${label}please enter a valid claim amount.`;
      if (isForeignCurrency(l.currency)) {
        const rate = rateForLine(l);
        if (rate == null) {
          if (ratesTableMissing) return `${label}company exchange rates are not set up yet - the administrator needs to run supabase/add_fx_rates.sql. Please submit in HKD for now.`;
          if (companyRates) return `${label}no company exchange rate is set for ${l.currency} yet - please ask your administrator to add one in the Admin Hub (FX Rates tab).`;
          return `${label}please enter the exchange rate (HKD per 1 ${l.currency}).`;
        }
      }
      if (!l.file) return `${label}please attach one receipt image or PDF.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (!hasManager) {
      setFormError('No manager is on file for your account. Please contact your administrator before submitting a claim.');
      return;
    }
    const validation = validateLines();
    if (validation) {
      setFormError(validation);
      return;
    }

    const batch = lines;
    setIsSubmitting(true);

    // One claim group id shared by every line of THIS submission - the
    // manager approves the whole claim and finance gets one itemised email.
    const groupId = newClaimGroupId();

    const submittedClaims: ExpenseClaim[] = [];
    let failError = '';
    try {
      for (let i = 0; i < batch.length; i++) {
        const line = batch[i];
        setSubmitProgress({ current: i + 1, total: batch.length });
        const result = await expensesService.submitClaim({
          staffName,
          email: staffEmail,
          managerEmail,
          managerName,
          expenseType: line.expenseType,
          expenseDate: line.expenseDate,
          description: line.description,
          amount: parseFloat(line.amount),
          currency: line.currency,
          fxRate: rateForLine(line) ?? 0, // validation guarantees a rate exists here
          customerName: line.customerName,
          budgetCode: line.budgetCode
        }, line.file!, { claimGroupId: groupId, notify: false });

        if (!result.success) {
          failError = result.error || 'Could not submit the claim. Please try again.';
          break;
        }
        if (result.claim) {
          submittedClaims.push(result.claim);
          setClaims(prev => [result.claim!, ...prev]);
        }
      }
    } catch (err: any) {
      failError = err?.message || 'Unexpected error while submitting.';
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(null);
    }

    // Whatever landed in the database is a complete (partial) claim - notify
    // the manager about exactly those items, once. A retry of the remaining
    // lines becomes its own claim with its own notification.
    if (submittedClaims.length > 0) notifyClaimEvent('submitted', submittedClaims);

    if (failError) {
      // Keep whatever was NOT submitted (the failed line and everything after
      // it) in the form so nothing has to be retyped - just press Submit again.
      const submitted = submittedClaims.length;
      setLines(batch.slice(submitted));
      setFormError(
        submitted > 0
          ? `Claim ${submitted + 1} of ${batch.length} could not be submitted: ${failError} The first ${submitted} claim${submitted > 1 ? 's were' : ' was'} submitted successfully - the remaining claim${batch.length - submitted > 1 ? 's are' : ' is'} still in the form below, please press Submit again.`
          : `Could not submit the claim: ${failError}`
      );
      return;
    }

    const total = batch.reduce((sum, l) => sum + lineHkd(l), 0);
    setSuccessMsg(
      batch.length > 1
        ? `${batch.length} claims submitted for a total of ${formatMoney(total)}. ${managerName || 'Your manager'} has been notified to review them.`
        : `Claim for ${formatMoney(total)} submitted. ${managerName || 'Your manager'} has been notified to review it.`
    );
    setLines([makeLine()]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openReceipt = async (claim: ExpenseClaim) => {
    const { url, error } = await expensesService.getReceiptUrl(claim);
    if (url) window.open(url, '_blank', 'noopener');
    else alert(`Could not open receipt: ${error}`);
  };

  const totalAmount = lines.reduce((sum, l) => sum + lineHkd(l), 0);
  const today = new Date().toISOString().split('T')[0];

  // How many items belong to the same claim (submission) as this row.
  const groupSizeOf = (c: ExpenseClaim): number =>
    claims.filter(o => claimGroupKey(o) === claimGroupKey(c)).length;

  const noticeClaims = reviewNotice?.claims || [];
  const noticeFirst = noticeClaims[0];
  const noticeTotal = noticeClaims.reduce((t, c) => t + claimHkd(c), 0);

  const inputClass = "w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-medium focus:border-slate-900 outline-none transition-all placeholder:text-slate-300";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {reviewNotice && noticeFirst && (
        <div className={`p-5 rounded-2xl border-l-4 shadow-sm ${noticeFirst.status === 'approved' ? 'bg-green-50 border-green-400' : noticeFirst.status === 'pending_gm' ? 'bg-amber-50 border-amber-400' : 'bg-red-50 border-red-400'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-sm font-black ${noticeFirst.status === 'approved' ? 'text-green-700' : noticeFirst.status === 'pending_gm' ? 'text-amber-700' : 'text-red-700'}`}>
                {noticeFirst.status === 'approved' ? 'Expense Claim Approved' : noticeFirst.status === 'pending_gm' ? 'Expense Claim Approved by Your Manager' : 'Expense Claim Not Approved'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Your claim{noticeClaims.length > 1 ? ` (${noticeClaims.length} items)` : ''} of <strong>{formatMoney(noticeTotal)}</strong>
                {noticeClaims.length === 1 && <> ({expenseTypeLabel(noticeFirst.expenseType)}, {noticeFirst.expenseDate})</>}
                {noticeFirst.status === 'approved' && (
                  <> has received final approval from the General Manager. <strong>{PAYMENT_TERMS_TEXT}</strong> Finance has been notified to process the payment.</>
                )}
                {noticeFirst.status === 'pending_gm' && (
                  <> has been approved by your manager and is now with the General Manager for the final approval. No action is needed from you right now.</>
                )}
                {noticeFirst.status === 'rejected' && (
                  <> was not approved at the {noticeFirst.gmComment ? 'General Manager' : 'line manager'} review stage. Please resubmit an amended claim with the necessary corrections.</>
                )}
                {noticeFirst.reviewComment ? ` Manager comment: "${noticeFirst.reviewComment}"` : ''}
                {noticeFirst.gmComment ? ` General Manager comment: "${noticeFirst.gmComment}"` : ''}
              </p>
            </div>
            <button onClick={dismissNotice} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 whitespace-nowrap">Got it</button>
          </div>
        </div>
      )}

      {/* Submit form */}
      <div className="bg-white rounded-3xl shadow-xl border p-8 md:p-10">
        <div className="mb-8">
          <h3 className="text-xl font-black text-slate-900">Submit Expense Claims</h3>
          <p className="text-sm text-slate-500 mt-1">
            Log one or several claims in a single submission - press <strong>Add More</strong> for each additional claim.
            Every claim needs its own receipt. Once submitted, {managerName || 'your manager'} reviews it first and the General Manager gives the final approval. Approved claims are paid within 30 days.
          </p>
          {!hasManager && (
            <p className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 rounded-2xl p-4 mt-4">
              No manager is on file for your account yet - claims cannot be submitted until your administrator assigns one.
            </p>
          )}
        </div>

        {successMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-100 text-sm font-bold text-green-700">{successMsg}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {lines.map((line, idx) => (
            <div key={line.key} className="relative bg-slate-50/60 border-2 border-slate-100 rounded-3xl p-6 md:p-7 space-y-5">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-500">
                  {lines.length > 1 ? `Claim ${idx + 1} of ${lines.length}` : 'New Claim'}
                </span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <label className={labelClass}>Expense Type</label>
                  <select
                    value={line.expenseType}
                    onChange={(e) => updateLine(line.key, { expenseType: e.target.value })}
                    className={inputClass}
                    required
                  >
                    {EXPENSE_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Date of Expense</label>
                  <input
                    type="date"
                    value={line.expenseDate}
                    max={today}
                    onChange={(e) => updateLine(line.key, { expenseDate: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Currency</label>
                  <select
                    value={line.currency}
                    onChange={(e) => {
                      const v = e.target.value;
                      const r = v === 'HKD'
                        ? '1'
                        : (companyRates?.[v] ? String(companyRates[v].rate) : line.fxRate);
                      updateLine(line.key, { currency: v, fxRate: r });
                    }}
                    className={inputClass}
                  >
                    {EXPENSE_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Amount ({line.currency})</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={line.amount}
                    onChange={(e) => updateLine(line.key, { amount: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {isForeignCurrency(line.currency) && (
                  <div>
                    <label className={labelClass}>Exchange Rate (HKD per 1 {line.currency})</label>
                    {companyRates ? (
                      rateForLine(line) != null ? (
                        <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                          <p className="text-sm font-black text-slate-800">1 {line.currency} = {fxRateText(rateForLine(line))} HKD</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 leading-relaxed">
                            Company rate{companyRates[line.currency]?.seeded ? ' (company default)' : ''}{rateSetDate(line.currency) ? ` · set ${rateSetDate(line.currency)}` : ''} - fixed by the administrator
                          </p>
                        </div>
                      ) : (
                        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                          <p className="text-xs font-black text-amber-700 leading-relaxed">No company rate is set for {line.currency} yet. Please ask your administrator to add one in the Admin Hub (FX Rates tab) - foreign-currency claims are paused until then.</p>
                        </div>
                      )
                    ) : (
                      <input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        placeholder="e.g. 7.8000"
                        value={line.fxRate}
                        onChange={(e) => updateLine(line.key, { fxRate: e.target.value })}
                        className={inputClass}
                        required
                      />
                    )}
                    {(parseFloat(line.amount) || 0) > 0 && rateForLine(line) != null && (
                      <p className="text-[11px] font-black text-brand-600 mt-1.5 uppercase tracking-widest">
                        = {formatMoney(lineHkd(line))} HKD
                      </p>
                    )}
                  </div>
                )}
                <div className={isForeignCurrency(line.currency) ? '' : 'md:col-span-2'}>
                  <label className={labelClass}>Customer / Client (optional)</label>
                  <input
                    type="text"
                    value={line.customerName}
                    onChange={(e) => updateLine(line.key, { customerName: e.target.value })}
                    placeholder="e.g. ABC Corp"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Brand Budget Code (optional)</label>
                  <input
                    type="text"
                    value={line.budgetCode}
                    onChange={(e) => updateLine(line.key, { budgetCode: e.target.value })}
                    placeholder="e.g. EST008"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Description / Business Purpose</label>
                <textarea
                  value={line.description}
                  onChange={(e) => updateLine(line.key, { description: e.target.value })}
                  rows={2}
                  placeholder="e.g. Client dinner with ABC Corp - quarterly business review"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Receipt (image or PDF, max 5 MB)</label>
                <input
                  ref={(el) => { fileInputRefs.current[line.key] = el; }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
                  onChange={(e) => handleLineFileChange(line.key, e)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-2xl file:border-0 file:bg-slate-900 file:text-white file:text-xs file:font-black file:uppercase file:tracking-widest file:cursor-pointer hover:file:bg-black file:transition-all"
                />
                {line.file && (
                  <p className="text-xs font-bold text-slate-500 mt-2 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {line.file.name} ({(line.file.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>
            </div>
          ))}

          {lines.length < MAX_CLAIM_LINES && (
            <button
              type="button"
              onClick={addLine}
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 font-black text-xs uppercase tracking-[0.2em] hover:border-slate-900 hover:text-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add More
            </button>
          )}

          {formError && (
            <p className="text-xs font-bold text-red-500 bg-red-50 p-4 rounded-2xl border border-red-100">{formError}</p>
          )}

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-xs font-bold text-slate-400">
              {lines.length > 1 ? (
                <>{lines.length} claims ready &middot; Total <span className="text-slate-900 font-black">{formatMoney(totalAmount)}</span>{lines.some(l => isForeignCurrency(l.currency)) && <span className="text-slate-400"> (HKD)</span>}</>
              ) : (
                'Items submitted together are reviewed as one claim.'
              )}
            </p>
            <button
              type="submit"
              disabled={isSubmitting || !hasManager}
              className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-black transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSubmitting
                ? (submitProgress ? `Submitting ${submitProgress.current} of ${submitProgress.total}...` : 'Submitting...')
                : (lines.length > 1 ? `Submit ${lines.length} Claims` : 'Submit Claim')}
            </button>
          </div>
        </form>
      </div>

      {/* My claims */}
      <div className="bg-white rounded-3xl shadow-xl border overflow-hidden">
        <div className="px-8 py-5 border-b bg-slate-50">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">My Claims ({claims.length})</h3>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-xs font-black uppercase tracking-widest text-slate-300">Loading claims...</div>
        ) : loadError ? (
          <div className="p-8 text-center text-xs font-bold text-red-500">{loadError}</div>
        ) : claims.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-bold text-slate-400">No expense claims yet.</p>
            <p className="text-xs text-slate-300 mt-1">Your submitted claims and their approval status will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Submitted</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {claims.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-8 py-5 text-xs font-bold text-slate-500 whitespace-nowrap">
                      {(c.createdAt || '').split('T')[0]}
                      {groupSizeOf(c) > 1 && (
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">part of {groupSizeOf(c)}-item claim</p>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-slate-800 whitespace-nowrap">{expenseTypeLabel(c.expenseType)}</p>
                      <p className="text-[11px] text-slate-400">{c.expenseDate}</p>
                    </td>
                    <td className="px-8 py-5 max-w-[280px]">
                      <p className="text-xs text-slate-600 truncate" title={c.description}>{c.description}</p>
                      {(c.customerName || c.budgetCode) && (
                        <p className="text-[11px] text-slate-400 mt-1 truncate">
                          {c.customerName}{c.customerName && c.budgetCode ? ' \u00b7 ' : ''}{c.budgetCode ? `Budget: ${c.budgetCode}` : ''}
                        </p>
                      )}
                      {c.reviewComment && <p className="text-[11px] text-slate-400 italic mt-1 truncate" title={c.reviewComment}>Mgr: "{c.reviewComment}"</p>}
                      {c.gmComment && <p className="text-[11px] text-slate-400 italic mt-1 truncate" title={c.gmComment}>GM: "{c.gmComment}"</p>}
                    </td>
                    <td className="px-8 py-5 text-right whitespace-nowrap"><ClaimAmount claim={c} /></td>
                    <td className="px-8 py-5"><StatusChip claim={c} /></td>
                    <td className="px-8 py-5 text-right">
                      <button onClick={() => openReceipt(c)} className="text-xs font-black text-brand-600 uppercase tracking-widest hover:underline whitespace-nowrap">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseClaims;
