
import React, { useState, useEffect, useRef } from 'react';
import { ExpenseClaim } from '../types.ts';
import { expensesService, validateReceiptFile } from '../services/expenses.ts';
import { EXPENSE_TYPES, expenseTypeLabel, formatMoney } from '../constants.ts';

interface ExpenseClaimsProps {
  staffName: string;
  staffEmail: string;
  managerEmail: string;
  managerName?: string;
}

const SEEN_KEY = 'metabev-expense-seen-at';

const StatusChip: React.FC<{ claim: ExpenseClaim }> = ({ claim }) => {
  const map = {
    submitted: { text: 'Pending Approval', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
    approved:  { text: 'Approved',         classes: 'bg-green-50 text-green-700 border-green-200' },
    rejected:  { text: 'Not Approved',     classes: 'bg-red-50 text-red-700 border-red-200' }
  };
  const s = map[claim.status];
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

  const [expenseType, setExpenseType] = useState(EXPENSE_TYPES[0]?.code || '');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [reviewNotice, setReviewNotice] = useState<{ claim: ExpenseClaim } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Approval/rejection notice: surface the most recent outcome the staff
      // member has not seen yet (acknowledged in THIS browser via localStorage).
      const reviewed = own.filter(c => c.reviewedAt).sort((a, b) => (a.reviewedAt! < b.reviewedAt! ? 1 : -1));
      if (reviewed.length > 0) {
        let lastSeen = '';
        try { lastSeen = localStorage.getItem(SEEN_KEY) || ''; } catch { /* ignore */ }
        if (!lastSeen || reviewed[0].reviewedAt! > lastSeen) {
          setReviewNotice({ claim: reviewed[0] });
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const dismissNotice = () => {
    try { localStorage.setItem(SEEN_KEY, reviewNotice!.claim.reviewedAt!); } catch { /* ignore */ }
    setReviewNotice(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFormError('');
    if (f) {
      const validation = validateReceiptFile(f);
      if (validation) { setFormError(validation); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; return; }
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (!hasManager) {
      setFormError('No manager is on file for your account. Please contact your administrator before submitting a claim.');
      return;
    }
    const amt = parseFloat(amount);
    if (!expenseType) { setFormError('Please choose an expense type.'); return; }
    if (!expenseDate) { setFormError('Please choose the date of the expense.'); return; }
    if (!description.trim()) { setFormError('Please describe the expense (what it was for).'); return; }
    if (!amt || amt <= 0) { setFormError('Please enter a valid claim amount.'); return; }
    if (!file) { setFormError('Please attach one receipt image or PDF for this claim.'); return; }

    setIsSubmitting(true);
    try {
      const result = await expensesService.submitClaim({
        staffName,
        email: staffEmail,
        managerEmail,
        managerName,
        expenseType,
        expenseDate,
        description,
        amount: amt
      }, file);

      if (!result.success) {
        setFormError(result.error || 'Could not submit the claim. Please try again.');
        return;
      }

      if (result.claim) setClaims(prev => [result.claim!, ...prev]);
      setSuccessMsg(`Claim for ${formatMoney(amt)} submitted. ${managerName || 'Your manager'} has been notified to review it.`);
      setExpenseType(EXPENSE_TYPES[0]?.code || '');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setAmount('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReceipt = async (claim: ExpenseClaim) => {
    const { url, error } = await expensesService.getReceiptUrl(claim);
    if (url) window.open(url, '_blank', 'noopener');
    else alert(`Could not open receipt: ${error}`);
  };

  const inputClass = "w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-medium focus:border-slate-900 outline-none transition-all placeholder:text-slate-300";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {reviewNotice && (
        <div className={`p-5 rounded-2xl border-l-4 shadow-sm ${reviewNotice.claim.status === 'approved' ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-sm font-black ${reviewNotice.claim.status === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
                {reviewNotice.claim.status === 'approved' ? 'Expense Claim Approved' : 'Expense Claim Not Approved'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Your claim of <strong>{formatMoney(reviewNotice.claim.amount)}</strong> ({expenseTypeLabel(reviewNotice.claim.expenseType)}, {reviewNotice.claim.expenseDate})
                {reviewNotice.claim.status === 'approved' ? ' has been approved. Finance has been asked to process the payment.' : ' was not approved by your manager.'}
                {reviewNotice.claim.reviewComment ? ` Comment: "${reviewNotice.claim.reviewComment}"` : ''}
              </p>
            </div>
            <button onClick={dismissNotice} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 whitespace-nowrap">Got it</button>
          </div>
        </div>
      )}

      {/* Submit form */}
      <div className="bg-white rounded-3xl shadow-xl border p-8 md:p-10">
        <div className="mb-8">
          <h3 className="text-xl font-black text-slate-900">Submit an Expense Claim</h3>
          <p className="text-sm text-slate-500 mt-1">
            One receipt per claim. Once submitted, {managerName || 'your manager'} receives a notification to review and approve it.
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Expense Type</label>
              <select value={expenseType} onChange={(e) => setExpenseType(e.target.value)} className={inputClass} required>
                {EXPENSE_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date of Expense</label>
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} max={new Date().toISOString().split('T')[0]} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Amount (HKD)</label>
              <input type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required />
            </div>
          </div>

          <div>
            <label className={labelClass}>Description / Business Purpose</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="e.g. Client dinner with ABC Corp - quarterly business review" className={inputClass} required />
          </div>

          <div>
            <label className={labelClass}>Receipt (image or PDF, max 5 MB)</label>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
                onChange={handleFileChange}
                className="flex-1 text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-2xl file:border-0 file:bg-slate-900 file:text-white file:text-xs file:font-black file:uppercase file:tracking-widest file:cursor-pointer hover:file:bg-black file:transition-all"
              />
            </div>
            {file && (
              <p className="text-xs font-bold text-slate-500 mt-2 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          {formError && (
            <p className="text-xs font-bold text-red-500 bg-red-50 p-4 rounded-2xl border border-red-100">{formError}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !hasManager}
              className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-black transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Claim'}
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
                    <td className="px-8 py-5 text-xs font-bold text-slate-500 whitespace-nowrap">{(c.createdAt || '').split('T')[0]}</td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-slate-800 whitespace-nowrap">{expenseTypeLabel(c.expenseType)}</p>
                      <p className="text-[11px] text-slate-400">{c.expenseDate}</p>
                    </td>
                    <td className="px-8 py-5 max-w-[280px]">
                      <p className="text-xs text-slate-600 truncate" title={c.description}>{c.description}</p>
                      {c.reviewComment && <p className="text-[11px] text-slate-400 italic mt-1 truncate" title={c.reviewComment}>Mgr: "{c.reviewComment}"</p>}
                    </td>
                    <td className="px-8 py-5 text-right text-sm font-black text-slate-800 whitespace-nowrap">{formatMoney(c.amount, c.currency)}</td>
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
