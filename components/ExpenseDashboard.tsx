
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ExpenseClaim } from '../types.ts';
import { expensesService, claimGroupKey } from '../services/expenses.ts';
import { EXPENSE_TYPES, expenseTypeLabel, formatMoney } from '../constants.ts';

interface ExpenseDashboardProps {
  currentUserEmail: string;
}

type Access = 'checking' | 'granted' | 'locked' | 'unconfigured';
type StatusFilter = 'all' | 'approved' | 'submitted';

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

const selectCls =
  'bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 max-w-[240px]';

/**
 * Manager "Dashboard" tab - running totals of expense claims for
 * SELECTED managers (allowlist: expense_dashboard_viewers table).
 * RLS decides which rows come back; a viewer sees every claim.
 */
const ExpenseDashboard: React.FC<ExpenseDashboardProps> = ({ currentUserEmail }) => {
  const [access, setAccess] = useState<Access>('checking');
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [staffFilter, setStaffFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    setError('');
    const { viewer, configured } = await expensesService.isDashboardViewer();
    if (!viewer) {
      setAccess(configured ? 'locked' : 'unconfigured');
      return;
    }
    setAccess('granted');
    setIsLoading(true);
    const { data, error: claimsError } = await expensesService.getClaims();
    if (claimsError) setError(claimsError);
    setClaims(data);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Staff directory from the claims themselves (name follows the most recent claim)
  const staffList = useMemo(() => {
    const map = new Map<string, string>();
    claims.forEach(c => map.set(c.email, c.staffName || c.email));
    return [...map.entries()]
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [claims]);

  // --- filtering -------------------------------------------------------
  const staffMatched = useMemo(
    () => (staffFilter === 'all' ? claims : claims.filter(c => c.email === staffFilter)),
    [claims, staffFilter]
  );
  const typeMatched = useMemo(
    () => (typeFilter === 'all' ? staffMatched : staffMatched.filter(c => c.expenseType === typeFilter)),
    [staffMatched, typeFilter]
  );
  const filtered = useMemo(
    () => (statusFilter === 'all' ? typeMatched : typeMatched.filter(c => c.status === statusFilter)),
    [typeMatched, statusFilter]
  );
  const pendingWithinScope = useMemo(
    () => typeMatched.filter(c => c.status === 'submitted'),
    [typeMatched]
  );

  const total = filtered.reduce((t, c) => t + c.amount, 0);
  const claimCount = new Set(filtered.map(claimGroupKey)).size;
  const itemCount = filtered.length;
  const pendingTotal = pendingWithinScope.reduce((t, c) => t + c.amount, 0);

  // --- by expense type (respects staff + status filters) ---------------
  const byType = EXPENSE_TYPES
    .map(t => {
      const list = staffMatched.filter(c => c.expenseType === t.code && (statusFilter === 'all' || c.status === statusFilter));
      return { code: t.code, label: t.label, count: list.length, total: list.reduce((s, c) => s + c.amount, 0) };
    })
    .filter(t => t.count > 0);
  const maxTypeTotal = Math.max(...byType.map(t => t.total), 1);

  // --- by staff (respects type + status filters) -----------------------
  const byStaff = useMemo(() => {
    const map = new Map<string, { name: string; email: string; items: number; claims: Set<string>; total: number }>();
    typeMatched
      .filter(c => statusFilter === 'all' || c.status === statusFilter)
      .forEach(c => {
        const cur = map.get(c.email) || { name: c.staffName || c.email, email: c.email, items: 0, claims: new Set<string>(), total: 0 };
        cur.items += 1;
        cur.claims.add(claimGroupKey(c));
        cur.total += c.amount;
        map.set(c.email, cur);
      });
    return [...map.values()]
      .map(s => ({ ...s, claimCount: s.claims.size }))
      .sort((a, b) => b.total - a.total);
  }, [typeMatched, statusFilter]);
  const maxStaffTotal = Math.max(...byStaff.map(s => s.total), 1);

  // --- monthly trend, last 6 months (respects all filters) -------------
  const months = useMemo(() => {
    const out: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en', { month: 'short' }), total: 0 });
    }
    const idx = new Map(out.map((m, i) => [m.key, i]));
    filtered.forEach(c => {
      const k = (c.createdAt || '').slice(0, 7);
      const i = idx.get(k);
      if (i !== undefined) out[i].total += c.amount;
    });
    return out;
  }, [filtered]);
  const maxMonthTotal = Math.max(...months.map(m => m.total), 1);

  const hasFilters = staffFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all';

  // ---------------------------------------------------------------------
  if (access === 'checking') {
    return (
      <div className="bg-white rounded-3xl border p-12 text-center">
        <p className="text-sm font-bold text-slate-400">Checking dashboard access...</p>
      </div>
    );
  }

  if (access === 'unconfigured') {
    return (
      <div className="bg-white rounded-3xl border p-12 text-center">
        <p className="text-sm font-bold text-slate-600">The expense dashboard is not set up yet.</p>
        <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
            The viewer allowlist is missing. Ask the administrator to run
            <span className="font-mono text-[11px] bg-slate-100 rounded px-1.5 py-0.5 mx-1">supabase/add_dashboard.sql</span>
            in the Supabase SQL Editor, then reload this page.
        </p>
      </div>
    );
  }

  if (access === 'locked') {
    return (
      <div className="bg-white rounded-3xl border p-12 text-center">
        <p className="text-sm font-bold text-slate-600">You don't have access to the expense dashboard.</p>
        <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
          The dashboard is limited to selected managers. Ask the administrator to add
          <span className="font-mono text-[11px] bg-slate-100 rounded px-1.5 py-0.5 mx-1">{currentUserEmail}</span>
          to the dashboard viewers list.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="bg-white rounded-3xl border p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">Expense Dashboard</h3>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              Running totals across all expense claims{isLoading ? ' - loading...' : ` - ${claimCount} claims · ${itemCount} items in view`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={isLoading}
            className={`self-start px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${isLoading ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className={selectCls} aria-label="Filter by staff">
            <option value="all">All staff ({staffList.length})</option>
            {staffList.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectCls} aria-label="Filter by expense type">
            <option value="all">All expense types</option>
            {EXPENSE_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1 self-start">
            {([['all', 'All'], ['approved', 'Approved'], ['submitted', 'Pending']] as [StatusFilter, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${statusFilter === value ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button
              onClick={() => { setStaffFilter('all'); setTypeFilter('all'); setStatusFilter('all'); }}
              className="text-xs font-bold text-brand-600 hover:underline self-start px-1"
            >
              Clear filters
            </button>
          )}
        </div>
        {error && <p className="text-xs font-bold text-red-500">{error}</p>}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total claimed" value={formatMoney(total)} sub={hasFilters ? 'with current filters' : 'all claims in view'} accent="text-brand-600" />
        <KpiCard label="Claims" value={String(claimCount)} sub="one submission = one claim" />
        <KpiCard label="Line items" value={String(itemCount)} sub="individual receipts" />
        <KpiCard label="Pending total" value={formatMoney(pendingTotal)} sub={`${pendingWithinScope.length} item${pendingWithinScope.length === 1 ? '' : 's'} awaiting review`} accent={pendingTotal > 0 ? 'text-amber-600' : 'text-slate-900'} />
      </div>

      {claims.length === 0 && !isLoading ? (
        <div className="bg-white rounded-3xl border p-12 text-center">
          <p className="text-sm font-bold text-slate-400">No expense claims yet.</p>
          <p className="text-xs text-slate-300 mt-1">Totals will appear here as soon as the first claim is submitted.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By expense type */}
          <div className="bg-white rounded-3xl border p-6 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">By expense type</p>
            {byType.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold">Nothing matches the current filters.</p>
            ) : (
              <div className="space-y-3">
                {byType.map(t => (
                  <div key={t.code}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-xs font-bold text-slate-600">{t.label} <span className="text-slate-300">· {t.count} item{t.count === 1 ? '' : 's'}</span></span>
                      <span className="text-xs font-black text-slate-800">{formatMoney(t.total)}</span>
                    </div>
                    <Bar pct={(t.total / maxTypeTotal) * 100} color="bg-brand-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly trend */}
          <div className="bg-white rounded-3xl border p-6 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Last 6 months</p>
            <div className="flex items-end gap-3 h-36">
              {months.map(m => (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[10px] font-black text-slate-500">{m.total > 0 ? formatMoney(m.total) : ''}</span>
                  <div
                    className={`w-full rounded-t-lg transition-all ${m.total > 0 ? 'bg-brand-500' : 'bg-slate-100'}`}
                    style={{ height: `${Math.max((m.total / maxMonthTotal) * 100, 4)}%` }}
                  />
                  <span className="text-[10px] font-bold text-slate-400">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* By staff */}
      {byStaff.length > 0 && (
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">By staff member</p>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-y">
              <tr>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Claims</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Items</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/3">Share</th>
              </tr>
            </thead>
            <tbody>
              {byStaff.map(s => (
                <tr key={s.email} className="border-b last:border-0">
                  <td className="px-6 py-4">
                    <p className="text-xs font-black text-slate-800">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{s.email}</p>
                  </td>
                  <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">{s.claimCount}</td>
                  <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">{s.items}</td>
                  <td className="px-6 py-4 text-right text-xs font-black text-slate-900">{formatMoney(s.total)}</td>
                  <td className="px-6 py-4"><Bar pct={(s.total / maxStaffTotal) * 100} color="bg-emerald-500" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ExpenseDashboard;
