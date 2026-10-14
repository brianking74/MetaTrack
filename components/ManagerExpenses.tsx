
import React, { useState } from 'react';
import { ExpenseClaim } from '../types.ts';
import { expensesService } from '../services/expenses.ts';
import { expenseTypeLabel, formatMoney } from '../constants.ts';

interface ManagerExpensesProps {
  claims: ExpenseClaim[];
  isLoading: boolean;
  error?: string;
  currentUserEmail: string;
  onRefresh: () => void;
}

const pending = (claims: ExpenseClaim[]) => claims.filter(c => c.status === 'submitted');
const reviewed = (claims: ExpenseClaim[]) =>
  claims.filter(c => c.status !== 'submitted')
        .sort((a, b) => ((a.reviewedAt || '') < (b.reviewedAt || '') ? 1 : -1));

const ReviewCard: React.FC<{
  claim: ExpenseClaim;
  currentUserEmail: string;
  onRefresh: () => void;
}> = ({ claim, currentUserEmail, onRefresh }) => {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState('');

  const decide = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !comment.trim()) {
      if (!confirm('Reject without a comment? The staff member will not know why.')) return;
    }
    setBusy(decision);
    setError('');
    const result = await expensesService.reviewClaim(claim, decision, comment, currentUserEmail);
    setBusy(null);
    if (!result.success) {
      setError(result.error || 'Review failed. Please try again.');
      return;
    }
    onRefresh();
  };

  const openReceipt = async () => {
    const { url, error } = await expensesService.getReceiptUrl(claim);
    if (url) window.open(url, '_blank', 'noopener');
    else setError(error || 'Could not open the receipt.');
  };

  return (
    <div className="border border-slate-200 rounded-3xl p-6 md:p-8 hover:shadow-lg transition-all bg-white">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h4 className="text-lg font-black text-slate-900">{claim.staffName}</h4>
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-blue-50 text-blue-700 border-blue-200">
              {expenseTypeLabel(claim.expenseType)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{claim.email} · Expense date {claim.expenseDate} · Submitted {(claim.createdAt || '').split('T')[0]}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-2xl font-black text-slate-900 whitespace-nowrap">{formatMoney(claim.amount, claim.currency)}</p>
        </div>
      </div>

      <p className="text-sm text-slate-600 mt-4 bg-slate-50 rounded-2xl p-4">{claim.description}</p>

      <div className="mt-5 flex flex-col md:flex-row md:items-center gap-4">
        <button onClick={openReceipt} className="bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          View Receipt
        </button>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment to the staff member..."
          className="flex-1 px-5 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-medium text-slate-800 focus:border-slate-900 outline-none transition-all placeholder:text-slate-300"
        />
        <div className="flex gap-3">
          <button
            onClick={() => decide('rejected')}
            disabled={!!busy}
            className="px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {busy === 'rejected' ? 'Rejecting...' : 'Reject'}
          </button>
          <button
            onClick={() => decide('approved')}
            disabled={!!busy}
            className="px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm whitespace-nowrap"
          >
            {busy === 'approved' ? 'Approving...' : 'Approve & Notify'}
          </button>
        </div>
      </div>

      {error && <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 mt-4">{error}</p>}
    </div>
  );
};

const ManagerExpenses: React.FC<ManagerExpensesProps> = ({ claims, isLoading, error, currentUserEmail, onRefresh }) => {
  const pendingClaims = pending(claims);
  const reviewedClaims = reviewed(claims);

  const openReceipt = async (claim: ExpenseClaim) => {
    const { url, err } = { url: undefined as string | undefined, err: undefined as string | undefined, ...(await expensesService.getReceiptUrl(claim)) };
    if (url) window.open(url, '_blank', 'noopener');
    else alert(`Could not open receipt: ${err}`);
  };

  return (
    <div className="space-y-8">
      {/* Pending queue */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Awaiting My Review</h3>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${pendingClaims.length > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            {pendingClaims.length} pending
          </span>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-3xl border p-12 text-center text-xs font-black uppercase tracking-widest text-slate-300">Loading expense claims...</div>
        ) : error ? (
          <div className="bg-white rounded-3xl border p-8 text-center text-xs font-bold text-red-500">{error}</div>
        ) : pendingClaims.length === 0 ? (
          <div className="bg-white rounded-3xl border p-12 text-center">
            <p className="text-sm font-bold text-slate-400">Nothing waiting for your approval.</p>
            <p className="text-xs text-slate-300 mt-1">New claims from your team will appear here with their receipts.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {pendingClaims.map(c => (
              <ReviewCard key={c.id} claim={c} currentUserEmail={currentUserEmail} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-3xl shadow-xl border overflow-hidden">
        <div className="px-8 py-5 border-b bg-slate-50">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Review History ({reviewedClaims.length})</h3>
        </div>
        {reviewedClaims.length === 0 ? (
          <div className="p-10 text-center text-xs font-bold text-slate-300">No reviewed claims yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type / Date</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Decision</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reviewedClaims.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-slate-800">{c.staffName}</p>
                      <p className="text-[11px] text-slate-400">by {c.reviewedBy || '—'} on {(c.reviewedAt || '').split('T')[0]}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-bold text-slate-600 whitespace-nowrap">{expenseTypeLabel(c.expenseType)}</p>
                      <p className="text-[11px] text-slate-400">{c.expenseDate}</p>
                    </td>
                    <td className="px-8 py-5 max-w-[240px]">
                      <p className="text-xs text-slate-600 truncate" title={c.description}>{c.description}</p>
                      {c.reviewComment && <p className="text-[11px] text-slate-400 italic mt-1 truncate" title={c.reviewComment}>"{c.reviewComment}"</p>}
                    </td>
                    <td className="px-8 py-5 text-right text-sm font-black text-slate-800 whitespace-nowrap">{formatMoney(c.amount, c.currency)}</td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border whitespace-nowrap ${c.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {c.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button onClick={() => openReceipt(c)} className="text-xs font-black text-brand-600 uppercase tracking-widest hover:underline">View</button>
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

export default ManagerExpenses;
