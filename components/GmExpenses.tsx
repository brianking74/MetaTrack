
import React, { useState } from 'react';
import { ExpenseClaim } from '../types.ts';
import { expensesService, groupClaims, ClaimGroup } from '../services/expenses.ts';
import { expenseTypeLabel, formatMoney, EXPENSE_GM_TITLE } from '../constants.ts';
import ClaimAmount from './ClaimAmount.tsx';

interface GmExpensesProps {
  claims: ExpenseClaim[];
  isLoading: boolean;
  error?: string;
  currentUserEmail: string;
  onRefresh: () => void;
}

const decided = (claims: ExpenseClaim[]) =>
  claims.filter(c => c.status === 'approved' || c.status === 'rejected')
        .sort((a, b) => ((a.reviewedAt || '') < (b.reviewedAt || '') ? 1 : -1));

/**
 * GM Approvals queue - the SECOND (final) approval stage.
 *
 * Every claim here was already approved by the claimant's line manager and
 * is waiting for the General Manager. Approving sends the staff member the
 * "paid within 30 days" notification and asks finance to pay the claim;
 * rejecting returns it to the staff member to resubmit an amended claim.
 * ONE card per CLAIM (a whole submission, which may hold several items).
 */
const GmReviewCard: React.FC<{
  group: ClaimGroup;
  currentUserEmail: string;
  onRefresh: () => void;
}> = ({ group, currentUserEmail, onRefresh }) => {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState('');

  const first = group.claims[0];
  const multi = group.claims.length > 1;

  const decide = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !comment.trim()) {
      const what = multi ? `all ${group.claims.length} items of this claim` : 'this claim';
      if (!confirm(`Reject ${what} without a comment? The staff member will be asked to resubmit an amended claim and will not know why.`)) return;
    }
    setBusy(decision);
    setError('');
    const result = await expensesService.reviewClaims(group.claims, decision, comment, currentUserEmail, 'gm');
    setBusy(null);
    if (!result.success) {
      setError(result.error || 'Review failed. Please try again.');
      return;
    }
    onRefresh();
  };

  const openReceipt = async (claim: ExpenseClaim) => {
    const { url, error } = await expensesService.getReceiptUrl(claim);
    if (url) window.open(url, '_blank', 'noopener');
    else setError(error || 'Could not open the receipt.');
  };

  return (
    <div className="border border-slate-200 rounded-3xl p-6 md:p-8 hover:shadow-lg transition-all bg-white">
      {/* Card header: who + when + claim total */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h4 className="text-lg font-black text-slate-900">{first.staffName}</h4>
            {multi && (
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-slate-900 text-white border-slate-900">
                {group.claims.length} items
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{first.email} · Submitted {(first.createdAt || '').split('T')[0]}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-2xl font-black text-slate-900 whitespace-nowrap">{formatMoney(group.total)}</p>
          {multi && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Claim total (HKD)</p>}
        </div>
      </div>

      {/* Stage-1 approval context: the line manager's decision */}
      <div className="mt-4 bg-green-50/60 border border-green-100 rounded-2xl px-4 py-3">
        <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">
          Approved by line manager{first.managerReviewedBy ? ` · ${first.managerReviewedBy}` : ''}{first.managerReviewedAt ? ` · ${(first.managerReviewedAt).split('T')[0]}` : ''}
        </p>
        {first.reviewComment && (
          <p className="text-xs text-slate-600 mt-1">Manager comment: "{first.reviewComment}"</p>
        )}
      </div>

      {/* Itemised lines of this claim */}
      <div className={`mt-4 bg-slate-50 rounded-2xl divide-y divide-slate-100 ${multi ? '' : 'p-4'}`}>
        {group.claims.map(c => (
          <div key={c.id} className={`flex flex-col md:flex-row md:items-center gap-3 ${multi ? 'p-4' : ''}`}>
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-white border-slate-200 text-slate-500 whitespace-nowrap self-start">
              {expenseTypeLabel(c.expenseType)}
            </span>
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap md:w-24">{c.expenseDate}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-600">{c.description}</p>
              {(c.customerName || c.budgetCode) && (
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {c.customerName}{c.customerName && c.budgetCode ? ' \u00b7 ' : ''}{c.budgetCode ? `Budget: ${c.budgetCode}` : ''}
                </p>
              )}
            </div>
            <div className="whitespace-nowrap md:text-right self-start md:self-auto"><ClaimAmount claim={c} /></div>
            <button
              onClick={() => openReceipt(c)}
              className="text-xs font-black text-brand-600 uppercase tracking-widest hover:underline whitespace-nowrap self-start md:self-auto"
            >
              Receipt
            </button>
          </div>
        ))}
      </div>

      {/* One decision for the whole claim */}
      <div className="mt-5 flex flex-col md:flex-row md:items-center gap-4">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={`Optional comment from the ${EXPENSE_GM_TITLE}...`}
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
            {busy === 'approved' ? 'Approving...' : 'Approve & Pay'}
          </button>
        </div>
      </div>

      {error && <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 mt-4">{error}</p>}
    </div>
  );
};

const GmExpenses: React.FC<GmExpensesProps> = ({ claims, isLoading, error, currentUserEmail, onRefresh }) => {
  // Claims that cleared the line manager and now await the GM's decision.
  const pendingGroups = groupClaims(claims.filter(c => c.status === 'pending_gm'));
  const pendingItemCount = claims.filter(c => c.status === 'pending_gm').length;
  const decidedClaims = decided(claims);

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
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Awaiting My Approval</h3>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${pendingGroups.length > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            {pendingGroups.length} claim{pendingGroups.length === 1 ? '' : 's'} · {pendingItemCount} item{pendingItemCount === 1 ? '' : 's'}
          </span>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-3xl border p-12 text-center text-xs font-black uppercase tracking-widest text-slate-300">Loading expense claims...</div>
        ) : error ? (
          <div className="bg-white rounded-3xl border p-8 text-center text-xs font-bold text-red-500">{error}</div>
        ) : pendingGroups.length === 0 ? (
          <div className="bg-white rounded-3xl border p-12 text-center">
            <p className="text-sm font-bold text-slate-400">Nothing waiting for your approval.</p>
            <p className="text-xs text-slate-300 mt-1">Claims approved by line managers will appear here for your final decision.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {pendingGroups.map(g => (
              <GmReviewCard key={g.key} group={g} currentUserEmail={currentUserEmail} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-3xl shadow-xl border overflow-hidden">
        <div className="px-5 py-5 border-b bg-slate-50">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Final Decision History ({decidedClaims.length})</h3>
        </div>
        {decidedClaims.length === 0 ? (
          <div className="p-10 text-center text-xs font-bold text-slate-300">No final decisions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type / Date</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Decision</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {decidedClaims.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-5">
                      <p className="text-sm font-bold text-slate-800">{c.staffName}</p>
                      <p className="text-[11px] text-slate-400">
                        line mgr: {c.managerReviewedBy || c.managerEmail || '—'}
                        {c.reviewedBy && <> · final: {c.reviewedBy}{c.reviewedAt ? ` on ${(c.reviewedAt).split('T')[0]}` : ''}</>}
                      </p>
                    </td>
                    <td className="px-5 py-5">
                      <p className="text-xs font-bold text-slate-600">{expenseTypeLabel(c.expenseType)}</p>
                      <p className="text-[11px] text-slate-400">{c.expenseDate}</p>
                    </td>
                    <td className="px-5 py-5 max-w-[240px]">
                      <p className="text-xs text-slate-600 truncate" title={c.description}>{c.description}</p>
                      {(c.customerName || c.budgetCode) && (
                        <p className="text-[11px] text-slate-400 mt-1 truncate">
                          {c.customerName}{c.customerName && c.budgetCode ? ' \u00b7 ' : ''}{c.budgetCode ? `Budget: ${c.budgetCode}` : ''}
                        </p>
                      )}
                      {c.reviewComment && <p className="text-[11px] text-slate-400 italic mt-1 truncate" title={c.reviewComment}>Mgr: "{c.reviewComment}"</p>}
                      {c.gmComment && <p className="text-[11px] text-slate-400 italic mt-1 truncate" title={c.gmComment}>GM: "{c.gmComment}"</p>}
                    </td>
                    <td className="px-5 py-5 text-right whitespace-nowrap"><ClaimAmount claim={c} /></td>
                    <td className="px-5 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border whitespace-nowrap ${c.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {c.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </td>
                    <td className="px-5 py-5 text-right">
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

export default GmExpenses;
