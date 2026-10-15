
import React, { useState } from 'react';
import { ExpenseClaim } from '../types.ts';
import { expensesService, claimGroupKey } from '../services/expenses.ts';
import { EXPENSE_TYPES, expenseTypeLabel, formatMoney } from '../constants.ts';

interface AdminExpensesProps {
  claims: ExpenseClaim[];
  isLoading: boolean;
  error?: string;
  currentUserEmail: string;
  onRefresh: () => void;
}

const KpiCard: React.FC<{ label: string; value: string; sub?: string; accent?: string }> = ({ label, value, sub, accent = 'text-slate-900' }) => (
  <div className="bg-white rounded-3xl border p-6 shadow-sm">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    <p className={`text-2xl font-black mt-2 ${accent}`}>{value}</p>
    {sub && <p className="text-[11px] font-bold text-slate-400 mt-1">{sub}</p>}
  </div>
);

const Bar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 1.5)}%` }} />
  </div>
);

const AdminExpenses: React.FC<AdminExpensesProps> = ({ claims, isLoading, error, currentUserEmail, onRefresh }) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  const sum = (list: ExpenseClaim[]) => list.reduce((t, c) => t + c.amount, 0);
  const pendingClaims = claims.filter(c => c.status === 'submitted');
  const approvedClaims = claims.filter(c => c.status === 'approved');
  const rejectedClaims = claims.filter(c => c.status === 'rejected');

  // --- by type ---
  const byType = EXPENSE_TYPES
    .map(t => {
      const list = claims.filter(c => c.expenseType === t.code);
      return { code: t.code, label: t.label, count: list.length, total: sum(list) };
    })
    .filter(t => t.count > 0);
  const maxTypeTotal = Math.max(...byType.map(t => t.total), 1);

  // --- by staff ---
  const staffMap = new Map<string, { name: string; email: string; count: number; total: number }>();
  claims.forEach(c => {
    const key = c.email;
    const cur = staffMap.get(key) || { name: c.staffName, email: c.email, count: 0, total: 0 };
    cur.count += 1;
    cur.total += c.amount;
    staffMap.set(key, cur);
  });
  const byStaff = [...staffMap.values()].sort((a, b) => b.total - a.total);
  const maxStaffTotal = Math.max(...byStaff.map(s => s.total), 1);

  // --- monthly trend (last 12 months by submission date) ---
  const months: { key: string; label: string; count: number; total: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en', { month: 'short' }), count: 0, total: 0 });
  }
  claims.forEach(c => {
    const key = (c.createdAt || '').slice(0, 7);
    const m = months.find(x => x.key === key);
    if (m) { m.count += 1; m.total += c.amount; }
  });
  const maxMonthTotal = Math.max(...months.map(m => m.total), 1);

  const review = async (claim: ExpenseClaim, decision: 'approved' | 'rejected') => {
    // Admin review acts on the WHOLE claim: every pending item of the same
    // submission is approved/rejected together with one notification.
    const group = claims.filter(c => c.status === 'submitted' && claimGroupKey(c) === claimGroupKey(claim));
    const groupTotal = group.reduce((t, c) => t + c.amount, 0);
    const scope = group.length > 1 ? ` (${group.length} items, ${formatMoney(groupTotal)})` : '';
    const comment = decision === 'rejected'
      ? prompt(`Reason for rejecting ${claim.staffName}'s claim${scope}? (sent to the staff member)`) || ''
      : '';
    setBusyId(claimGroupKey(claim));
    const result = await expensesService.reviewClaims(group, decision, comment, currentUserEmail);
    setBusyId(null);
    if (!result.success) { alert(`Review failed: ${result.error}`); return; }
    onRefresh();
  };

  const openReceipt = async (claim: ExpenseClaim) => {
    const { url, error } = await expensesService.getReceiptUrl(claim);
    if (url) window.open(url, '_blank', 'noopener');
    else alert(`Could not open receipt: ${error}`);
  };

  if (isLoading) {
    return <div className="bg-white rounded-3xl border p-12 text-center text-xs font-black uppercase tracking-widest text-slate-300">Loading expense analytics...</div>;
  }
  if (error) {
    return <div className="bg-white rounded-3xl border p-8 text-center text-xs font-bold text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-8">
      {claims.length === 0 && (
        <div className="bg-white rounded-3xl border p-12 text-center">
          <p className="text-sm font-bold text-slate-400">No expense claims in the system yet.</p>
          <p className="text-xs text-slate-300 mt-1">Analytics will populate as staff submit claims.</p>
        </div>
      )}

      {claims.length > 0 && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <KpiCard label="Total Claims" value={String(claims.length)} sub={`${pendingClaims.length} awaiting review`} />
            <KpiCard label="Total Claimed" value={formatMoney(sum(claims))} sub={`${claims.length} claims`} />
            <KpiCard label="Approved" value={formatMoney(sum(approvedClaims))} sub={`${approvedClaims.length} claims`} accent="text-green-600" />
            <KpiCard label="Rejected" value={formatMoney(sum(rejectedClaims))} sub={`${rejectedClaims.length} claims`} accent="text-red-500" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* By type */}
            <div className="bg-white rounded-3xl shadow-xl border p-8">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-6">Claims by Type</h3>
              <div className="space-y-5">
                {byType.map(t => (
                  <div key={t.code}>
                    <div className="flex justify-between items-baseline mb-2">
                      <p className="text-sm font-bold text-slate-700">{t.label}</p>
                      <p className="text-xs font-black text-slate-500">{formatMoney(t.total)} · {t.count} claim{t.count === 1 ? '' : 's'}</p>
                    </div>
                    <Bar pct={(t.total / maxTypeTotal) * 100} color="bg-brand-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* By staff */}
            <div className="bg-white rounded-3xl shadow-xl border p-8">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-6">Claims by Staff Member</h3>
              <div className="space-y-5 max-h-[280px] overflow-y-auto pr-2">
                {byStaff.map(s => (
                  <div key={s.email}>
                    <div className="flex justify-between items-baseline mb-2">
                      <p className="text-sm font-bold text-slate-700 truncate" title={s.email}>{s.name}</p>
                      <p className="text-xs font-black text-slate-500 whitespace-nowrap ml-3">{formatMoney(s.total)} · {s.count} claim{s.count === 1 ? '' : 's'}</p>
                    </div>
                    <Bar pct={(s.total / maxStaffTotal) * 100} color="bg-blue-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly trend */}
          <div className="bg-white rounded-3xl shadow-xl border p-8">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-6">Claimed per Month (last 12 months)</h3>
            <div className="flex items-end gap-2 md:gap-3 h-40">
              {months.map(m => (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-2 min-w-0" title={`${m.key}: ${m.count} claims, ${formatMoney(m.total)}`}>
                  <span className="text-[9px] font-black text-slate-400 whitespace-nowrap">{m.total > 0 ? formatMoney(m.total) : ''}</span>
                  <div className="w-full bg-slate-100 rounded-t-lg relative flex-1 flex items-end">
                    <div className="w-full bg-brand-500 rounded-t-lg transition-all" style={{ height: `${(m.total / maxMonthTotal) * 100}%`, minHeight: m.total > 0 ? '6px' : '0' }} />
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* All claims */}
      <div className="bg-white rounded-3xl shadow-xl border overflow-hidden">
        <div className="px-8 py-5 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">All Claims ({claims.length})</h3>
          {pendingClaims.length > 0 && (
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-blue-50 text-blue-700 border-blue-200">
              {pendingClaims.length} pending
            </span>
          )}
        </div>
        {claims.length === 0 ? null : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manager</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type / Date</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {claims.map(c => {
                  const isPending = c.status === 'submitted';
                  const groupSize = claims.filter(o => claimGroupKey(o) === claimGroupKey(c)).length;
                  return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-slate-800 whitespace-nowrap">
                        {c.staffName}
                        {isPending && groupSize > 1 && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200 align-middle">{groupSize} items</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400">{c.email}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-bold text-slate-600 whitespace-nowrap">{c.managerName || '—'}</p>
                      <p className="text-[11px] text-slate-400">{c.managerEmail}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-bold text-slate-600 whitespace-nowrap">{expenseTypeLabel(c.expenseType)}</p>
                      <p className="text-[11px] text-slate-400">{c.expenseDate} · filed {(c.createdAt || '').split('T')[0]}</p>
                    </td>
                    <td className="px-8 py-5 max-w-[220px]">
                      <p className="text-xs text-slate-600 truncate" title={c.description}>{c.description}</p>
                    </td>
                    <td className="px-8 py-5 text-right text-sm font-black text-slate-800 whitespace-nowrap">{formatMoney(c.amount, c.currency)}</td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border whitespace-nowrap ${
                        c.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                        c.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {c.status === 'submitted' ? 'Pending' : c.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                      {c.reviewedBy && <p className="text-[10px] text-slate-400 mt-1">{c.reviewedBy}</p>}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-3 items-center whitespace-nowrap">
                        <button onClick={() => openReceipt(c)} className="text-xs font-black text-brand-600 uppercase tracking-widest hover:underline">Receipt</button>
                        {isPending ? (
                          <>
                            <button onClick={() => review(c, 'approved')} disabled={busyId === claimGroupKey(c)} className="text-xs font-black text-green-600 uppercase tracking-widest hover:underline disabled:opacity-50">Approve</button>
                            <button onClick={() => review(c, 'rejected')} disabled={busyId === claimGroupKey(c)} className="text-xs font-black text-red-400 uppercase tracking-widest hover:text-red-600 disabled:opacity-50">Reject</button>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 italic">Reviewed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminExpenses;
