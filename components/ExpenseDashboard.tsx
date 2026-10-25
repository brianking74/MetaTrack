
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ExpenseClaim } from '../types.ts';
import { expensesService, claimGroupKey, AnnualBudget } from '../services/expenses.ts';
import { EXPENSE_TYPES, expenseTypeLabel, formatMoney, claimHkd, EXPENSE_CURRENCY } from '../constants.ts';

interface ExpenseDashboardProps {
  currentUserEmail: string;
  /** True for the General Manager - unlocks the budget input in the header. */
  isGm?: boolean;
  /** Clicking a staff name in "By staff member" jumps to their claims. */
  onOpenStaffClaims?: (staffEmail: string) => void;
}

type Access = 'checking' | 'granted' | 'locked' | 'unconfigured';
type StatusFilter = 'all' | 'approved' | 'submitted' | 'pending_gm';
type PeriodFilter = 'week' | 'month' | 'year' | '12m' | 'all';

const PERIODS: [PeriodFilter, string][] = [
  ['week', 'This week'],
  ['month', 'This month'],
  ['year', 'This year'],
  ['12m', 'Last 12 months'],
  ['all', 'All time'],
];

/** ISO start instant of the selected period (null = no restriction). */
const periodStartIso = (p: PeriodFilter): string | null => {
  const now = new Date();
  switch (p) {
    case 'week': {
      // Monday-based calendar week
      const start = new Date(now);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case 'year':
      return new Date(now.getFullYear(), 0, 1).toISOString();
    case '12m':
      return new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
    default:
      return null;
  }
};

/** Short money label for the 12-month chart (exact figures live in tooltips). */
const compactMoney = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) return '';
  const prefix = EXPENSE_CURRENCY === 'HKD' ? 'HK$' : '$';
  if (Math.abs(n) >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}k`;
  return formatMoney(n);
};

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
 *
 * Extras: period filter (week/month/year/12m/all) that drives the KPIs
 * AND both charts, A&P (Approve & Pay = final GM-approved) totals with an
 * optional brand-budget-code sub-filter, click-through to a staff
 * member's claims, and a GM-only annual
 * budget panel (expense_budget table, supabase/add_budget.sql).
 */
const ExpenseDashboard: React.FC<ExpenseDashboardProps> = ({ currentUserEmail, isGm = false, onOpenStaffClaims }) => {
  const [access, setAccess] = useState<Access>('checking');
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [staffFilter, setStaffFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [codeFilter, setCodeFilter] = useState('all'); // brand budget code, offered once A&P is selected
  const [period, setPeriod] = useState<PeriodFilter>('year');

  // Budget panel (hidden entirely until add_budget.sql has been run)
  const budgetYear = new Date().getFullYear();
  const [budget, setBudget] = useState<AnnualBudget | null>(null);
  const [budgetMissing, setBudgetMissing] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetBusy, setBudgetBusy] = useState(false);
  const [budgetMsg, setBudgetMsg] = useState('');

  const load = useCallback(async () => {
    setError('');
    const { viewer, configured } = await expensesService.isDashboardViewer();
    if (!viewer) {
      setAccess(configured ? 'locked' : 'unconfigured');
      return;
    }
    setAccess('granted');
    setIsLoading(true);
    const [{ data, error: claimsError }, budgetResult] = await Promise.all([
      expensesService.getClaims(),
      expensesService.getAnnualBudget(new Date().getFullYear())
    ]);
    if (claimsError) setError(claimsError);
    setClaims(data);
    if (budgetResult.tableMissing) setBudgetMissing(true);
    else if (budgetResult.data) {
      setBudget(budgetResult.data);
      setBudgetInput(String(budgetResult.data.amount));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveBudget = async () => {
    const value = Number(budgetInput);
    if (!Number.isFinite(value) || value <= 0) {
      setBudgetMsg('Enter the yearly budget as a number, e.g. 500000.');
      return;
    }
    setBudgetBusy(true);
    setBudgetMsg('');
    const result = await expensesService.saveAnnualBudget(budgetYear, value, currentUserEmail);
    setBudgetBusy(false);
    if (!result.success) {
      setBudgetMsg(result.error || 'Could not save the budget. Please try again.');
      return;
    }
    setBudget({ year: budgetYear, amount: Math.round(value * 100) / 100, updatedBy: currentUserEmail, updatedAt: new Date().toISOString() });
    setBudgetMsg('Budget saved.');
  };

  // Staff directory from the claims themselves (name follows the most recent claim)
  const staffList = useMemo(() => {
    const map = new Map<string, string>();
    claims.forEach(c => map.set(c.email, c.staffName || c.email));
    return [...map.entries()]
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [claims]);

  // DEMO MODE (temporary): while demoing to users, the dashboard treats a
  // claim line's EXPENSE DATE (the date typed on the line) as its chart
  // date, so back-dated demo claims spread across the trend chart and the
  // period filters. The permanent behaviour keys off createdAt (the moment
  // the line was submitted) - swap chartDate back to createdAt when the
  // demo period ends.
  const chartDate = (c: { expenseDate?: string; createdAt?: string }): string =>
    c.expenseDate || c.createdAt || '';

  // --- filtering: period, then staff, then type, then status ------------
  const periodStart = periodStartIso(period);
  const inPeriod = useMemo(
    // chartDate is date-only (YYYY-MM-DD), so compare against the date
    // part of periodStart - keeps the first day of the period inclusive.
    () => (periodStart ? claims.filter(c => chartDate(c) >= periodStart.slice(0, 10)) : claims),
    [claims, periodStart]
  );
  const staffMatched = useMemo(
    () => (staffFilter === 'all' ? inPeriod : inPeriod.filter(c => c.email === staffFilter)),
    [inPeriod, staffFilter]
  );
  const typeMatched = useMemo(
    () => (typeFilter === 'all' ? staffMatched : staffMatched.filter(c => c.expenseType === typeFilter)),
    [staffMatched, typeFilter]
  );
  // Brand budget code sub-filter - the second (optional) box that appears
  // when A&P is selected. Mirrors the claim form's "Brand Budget Code"
  // field (e.g. EST008); claims without a code never match a chosen code.
  const codeMatched = useMemo(
    () => (codeFilter === 'all'
      ? typeMatched
      : typeMatched.filter(c => (c.budgetCode || '').trim() === codeFilter)),
    [typeMatched, codeFilter]
  );
  const filtered = useMemo(
    () => (statusFilter === 'all' ? codeMatched : codeMatched.filter(c => c.status === statusFilter)),
    [codeMatched, statusFilter]
  );
  const pendingWithinScope = useMemo(
    // 'Pending' = anywhere in the approval pipeline: with the line manager
    // or with the General Manager. Only fully approved claims leave it.
    () => codeMatched.filter(c => c.status === 'submitted' || c.status === 'pending_gm'),
    [codeMatched]
  );
  // Distinct codes within the selected period - keeps the dropdown stable
  // while the staff / type / status filters change.
  const codeOptions = useMemo(
    () => [...new Set(inPeriod.map(c => (c.budgetCode || '').trim()).filter(Boolean))].sort(),
    [inPeriod]
  );

  const total = filtered.reduce((t, c) => t + claimHkd(c), 0);
  const claimCount = new Set(filtered.map(claimGroupKey)).size;
  const itemCount = filtered.length;
  const staffCount = new Set(filtered.map(c => c.email)).size;

  // A&P = "Approve & Pay": claims with their FINAL GM approval
  const approvedClaims = useMemo(() => filtered.filter(c => c.status === 'approved'), [filtered]);
  const apTotal = approvedClaims.reduce((t, c) => t + claimHkd(c), 0);
  const apClaimCount = new Set(approvedClaims.map(claimGroupKey)).size;

  const pendingTotal = pendingWithinScope.reduce((t, c) => t + claimHkd(c), 0);

  // --- by expense type (respects staff + status filters) ---------------
  const byType = EXPENSE_TYPES
    .map(t => {
      const list = staffMatched.filter(c => c.expenseType === t.code
        && (statusFilter === 'all' || c.status === statusFilter)
        && (codeFilter === 'all' || (c.budgetCode || '').trim() === codeFilter));
      return { code: t.code, label: t.label, count: list.length, total: list.reduce((s, c) => s + claimHkd(c), 0) };
    })
    .filter(t => t.count > 0);
  const maxTypeTotal = Math.max(...byType.map(t => t.total), 1);

  // --- by staff (respects type + status filters) -----------------------
  const byStaff = useMemo(() => {
    const map = new Map<string, { name: string; email: string; items: number; claims: Set<string>; total: number }>();
    codeMatched
      .filter(c => statusFilter === 'all' || c.status === statusFilter)
      .forEach(c => {
        const cur = map.get(c.email) || { name: c.staffName || c.email, email: c.email, items: 0, claims: new Set<string>(), total: 0 };
        cur.items += 1;
        cur.claims.add(claimGroupKey(c));
        cur.total += claimHkd(c);
        map.set(c.email, cur);
      });
    return [...map.values()]
      .map(s => ({ ...s, claimCount: s.claims.size }))
      .sort((a, b) => b.total - a.total);
  }, [codeMatched, statusFilter]);
  const maxStaffTotal = Math.max(...byStaff.map(s => s.total), 1);

  // --- trend chart: the DATE FILTER drives the buckets (day-by-day for
  //     week / month, month-by-month for year / 12m / all time). It
  //     respects the staff / type / status / code filters too. ----------
  const trendBuckets = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const out: { key: string; label: string; total: number; ap: number }[] = [];

    if (period === 'week') {
      // Mon..Sun of the current (Monday-based) week, one bucket per day
      const start = new Date(now);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      start.setHours(0, 0, 0, 0);
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        out.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, label: names[d.getDay()], total: 0, ap: 0 });
      }
    } else if (period === 'month') {
      // 1st..last day of the current month
      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        out.push({ key: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(d)}`, label: String(d), total: 0, ap: 0 });
      }
    } else {
      // month buckets: rolling last 12 / Jan..now this year / all time
      let first: Date;
      let count: number;
      if (period === '12m') {
        first = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        count = 12;
      } else if (period === 'year') {
        first = new Date(now.getFullYear(), 0, 1);
        count = now.getMonth() + 1;
      } else {
        const minKey = claims.reduce<string>((min, c) => {
          const k = chartDate(c).slice(0, 7);
          return k && (!min || k < min) ? k : min;
        }, '') || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
        const [y, m] = minKey.split('-').map(Number);
        first = new Date(y, m - 1, 1);
        count = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) + 1;
      }
      for (let i = 0; i < count; i++) {
        const d = new Date(first.getFullYear(), first.getMonth() + i, 1);
        out.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: d.toLocaleString('en', { month: 'short' }), total: 0, ap: 0 });
      }
    }

    const daily = period === 'week' || period === 'month';
    const idx = new Map(out.map((b, i) => [b.key, i]));
    filtered.forEach(c => {
      const i = idx.get(chartDate(c).slice(0, daily ? 10 : 7));
      if (i === undefined) return;
      out[i].total += claimHkd(c);
      if (c.status === 'approved') out[i].ap += claimHkd(c);
    });
    return out;
  }, [filtered, period, claims]);
  const maxTrendTotal = Math.max(...trendBuckets.map(m => Math.max(m.total, m.ap)), 1);
  const labelStep = Math.max(1, Math.ceil(trendBuckets.length / 12));
  const periodLabel = PERIODS.find(([v]) => v === period)?.[1] || 'Trend';

  // --- budget vs spend (company-wide, current year, ignores the KPI
  //     filters; rejected claims are not committed spend) ----------------
  const yearSpend = useMemo(
    // DEMO MODE: uses chartDate (expense date) like the charts - see note
    // above. Permanent behaviour: (c.createdAt || '').slice(0, 4).
    () => claims
      .filter(c => c.status !== 'rejected' && chartDate(c).slice(0, 4) === String(budgetYear))
      .reduce((t, c) => t + claimHkd(c), 0),
    [claims, budgetYear]
  );
  const budgetPct = budget && budget.amount > 0 ? (yearSpend / budget.amount) * 100 : 0;
  const budgetRemaining = budget ? budget.amount - yearSpend : 0;

  const hasFilters = staffFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all' || codeFilter !== 'all';

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
      {/* Header + filters + budget panel */}
      <div className="bg-white rounded-3xl border p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-4">
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

            {/* Row 1: period / staff / expense type */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <select
                value={period}
                onChange={e => setPeriod(e.target.value as PeriodFilter)}
                className={selectCls}
                aria-label="Filter by date period"
              >
                {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className={selectCls} aria-label="Filter by staff">
                <option value="all">All staff ({staffList.length})</option>
                {staffList.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
              </select>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectCls} aria-label="Filter by expense type">
                <option value="all">All expense types</option>
                {EXPENSE_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
            {/* Row 2: status chips + (A&P only) brand budget code + clear */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-slate-100 rounded-lg p-1 gap-1 self-start">
                {([['all', 'All'], ['approved', 'A&P'], ['submitted', 'Pending'], ['pending_gm', 'Awaiting GM']] as [StatusFilter, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => { setStatusFilter(value); if (value !== 'approved') setCodeFilter('all'); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${statusFilter === value ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {statusFilter === 'approved' && (
                <select
                  value={codeFilter}
                  onChange={e => setCodeFilter(e.target.value)}
                  className={selectCls}
                  aria-label="Filter by brand budget code"
                >
                  <option value="all">All budget codes</option>
                  {codeOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {hasFilters && (
                <button
                  onClick={() => { setStaffFilter('all'); setTypeFilter('all'); setStatusFilter('all'); setCodeFilter('all'); }}
                  className="text-xs font-bold text-brand-600 hover:underline self-start px-1"
                >
                  Clear filters
                </button>
              )}
            </div>
            {error && <p className="text-xs font-bold text-red-500">{error}</p>}
          </div>

          {/* Budget panel - right of the filters; GM gets the edit controls */}
          {!budgetMissing && (
            <div className="lg:w-[320px] lg:border-l lg:border-slate-100 lg:pl-6">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Budget {budgetYear}</p>
                {isGm && (
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200">GM only</span>
                )}
              </div>
              {budget ? (
                <>
                  <p className="text-2xl font-black text-slate-900 mt-2">{formatMoney(budget.amount)}</p>
                  <div className="mt-3">
                    <Bar
                      pct={Math.min(budgetPct, 100)}
                      color={budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}
                    />
                    <div className="flex justify-between items-baseline gap-2 mt-1.5 text-[10px] font-bold text-slate-400">
                      <span>Spent {formatMoney(yearSpend)} ({Math.round(budgetPct)}%)</span>
                      <span className={budgetRemaining < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {budgetRemaining >= 0 ? `${formatMoney(budgetRemaining)} left` : `${formatMoney(-budgetRemaining)} over`}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs font-bold text-slate-400 mt-2">No budget set yet for {budgetYear}.</p>
              )}
              {isGm && (
                <div className="mt-3">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={budgetInput}
                      onChange={e => setBudgetInput(e.target.value)}
                      placeholder={`Total budget for ${budgetYear} (HKD)`}
                      aria-label={`Total budget for ${budgetYear}`}
                      className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    />
                    <button
                      onClick={saveBudget}
                      disabled={budgetBusy}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${budgetBusy ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                    >
                      {budgetBusy ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Spend = submitted claims this year, excluding rejected.</p>
                  {budgetMsg && (
                    <p className={`text-[10px] font-bold mt-1 ${budgetMsg.startsWith('Budget saved') ? 'text-emerald-600' : 'text-red-500'}`}>{budgetMsg}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Submitted" value={formatMoney(total)} sub={hasFilters ? 'with current filters' : 'all claims in view'} accent="text-brand-600" />
        <KpiCard label="A&P Total" value={formatMoney(apTotal)} sub={`${apClaimCount} claim${apClaimCount === 1 ? '' : 's'} approved & payable`} accent="text-emerald-600" />
        <KpiCard label="# Staff Submissions" value={String(staffCount)} sub="staff with claims in view" />
        <KpiCard label="Awaiting Approval" value={formatMoney(pendingTotal)} sub={`${pendingWithinScope.length} item${pendingWithinScope.length === 1 ? '' : 's'} awaiting review`} accent={pendingTotal > 0 ? 'text-amber-600' : 'text-slate-900'} />
      </div>

      {claims.length === 0 && !isLoading ? (
        <div className="bg-white rounded-3xl border p-12 text-center">
          <p className="text-sm font-bold text-slate-400">No expense claims yet.</p>
          <p className="text-xs text-slate-300 mt-1">Totals will appear here as soon as the first claim is submitted.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trend chart - buckets + title follow the date filter (left) */}
          <div className="bg-white rounded-3xl border p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{periodLabel}</p>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500 inline-block" /> Total submitted</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-800 inline-block" /> A&P approved</span>
              </div>
            </div>
            <div className="flex items-end gap-2 h-36">
              {trendBuckets.map((m, i) => (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-2 h-full justify-end min-w-0">
                  <span className="text-[9px] font-black text-slate-500 whitespace-nowrap">{trendBuckets.length <= 16 ? compactMoney(m.total) : ''}</span>
                  <div className="flex items-end justify-center gap-[3px] w-full h-full">
                    <div
                      className={`w-[40%] rounded-t-md transition-all ${m.total > 0 ? 'bg-brand-500' : 'bg-slate-100'}`}
                      style={{ height: `${Math.max((m.total / maxTrendTotal) * 100, 4)}%` }}
                      title={`Submitted ${m.label}: ${formatMoney(m.total)}`}
                    />
                    <div
                      className={`w-[40%] rounded-t-md transition-all ${m.ap > 0 ? 'bg-blue-800' : 'bg-slate-100'}`}
                      style={{ height: `${Math.max((m.ap / maxTrendTotal) * 100, 4)}%` }}
                      title={`A&P approved ${m.label}: ${formatMoney(m.ap)}`}
                    />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">{i % labelStep === 0 || i === trendBuckets.length - 1 ? m.label : '\u00a0'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By expense type (right side) */}
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
                    {onOpenStaffClaims ? (
                      <button
                        onClick={() => onOpenStaffClaims(s.email)}
                        className="text-left group"
                        title={`View all claims from ${s.name}`}
                      >
                        <p className="text-xs font-black text-slate-800 group-hover:text-brand-600 group-hover:underline">{s.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold group-hover:text-brand-500">{s.email}</p>
                      </button>
                    ) : (
                      <>
                        <p className="text-xs font-black text-slate-800">{s.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{s.email}</p>
                      </>
                    )}
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
