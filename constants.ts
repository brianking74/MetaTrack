
import { Rating, Competency, KPI, Assessment } from './types.ts';

// ============================================================
// EXPENSE CLAIMS MODULE
// ============================================================
// Flip to true (or leave true) once BOTH are done:
//   1. supabase/setup_expenses.sql has been run in the Supabase SQL Editor
//   2. Netlify env vars are in place if you want email notifications
//      (RESEND_API_KEY + FINANCE_EMAIL - see supabase/EXPENSES_RUNBOOK.md)
// While false, the Expense Claims tab is visible but greyed out and
// unselectable for every role ("Coming Soon").
export const EXPENSES_ENABLED = true;

// ---------------------------------------------------------------
// GENERAL MANAGER (second) APPROVAL STAGE
// ---------------------------------------------------------------
// Every approved claim must ALSO be approved by the General Manager
// before finance pays it. The GM reviews claims in the "GM Approvals"
// tab of the Manager Hub and is notified by email whenever a line
// manager approves a claim.
// Change the address here if the GM role moves to someone else - no
// other code change is needed (the address is stamped onto each claim
// at submission time and checked by the database RLS policies).
export const EXPENSE_GM_EMAIL = 'sophian@meta-bev.com';
export const EXPENSE_GM_TITLE = 'General Manager';

// The line shown to staff whenever a claim is finally approved - in the
// in-app banner and in the approval email (single source of truth).
export const PAYMENT_TERMS_TEXT = 'Expense claims will be paid within 30 days.';

// PILOT MODE - while the module is still being tested, ONLY the staff
// accounts listed here see the "Expense Claims" tab in the employee portal;
// it stays completely hidden from every other staff member. Managers and
// admins are not affected by this list (they need their approval queues).
//
// To open the module to everyone later: set this list to empty  ->  []
// and every staff member will get the tab automatically.
export const EXPENSES_PILOT_EMAILS: string[] = [
  'test.staff@metabev.com',   // <- dedicated test account (see EXPENSES_RUNBOOK.md)
  'daniel.wong@meta-bev.com', // <- multi-submission test account (Admin Hub, Oct 2026)
];

export const isExpensePilotUser = (email?: string | null): boolean =>
  !!email && EXPENSES_PILOT_EMAILS.some(e => e.toLowerCase().trim() === email.toLowerCase().trim());

// Expense types. Codes are stored on every claim row - ONLY ADD new
// entries, never rename or reuse a code (old claims keep their code and
// would otherwise display the wrong label). List mirrors the company's
// paper Travel/Expense Report categories (guideline 2):
// Transport, Hotel Room, Personal Meals, Business Meals & Entertainment,
// Telephone, Misc - plus MetaBev's A&P.
export const EXPENSE_TYPES: { code: string; label: string }[] = [
  { code: 'ENT', label: 'Entertainment & Business Meals' },
  { code: 'TRV', label: 'Travel & Transport' },
  { code: 'HTL', label: 'Hotel / Accommodation' },
  { code: 'MEL', label: 'Meals (Personal / Staff)' },
  { code: 'TEL', label: 'Telephone & Communication' },
  { code: 'AP',  label: 'A&P (Advertising & Promotion)' },
  { code: 'MIS', label: 'Misc / Other' },
];

export const expenseTypeLabel = (code: string): string =>
  EXPENSE_TYPES.find(t => t.code === code)?.label || code;

// Reporting currency - totals in the dashboard, analytics and emails are
// always expressed in HKD. A claim can be made in any currency below;
// the staff member enters the exchange rate and the portal stores both
// the original amount and the HKD equivalent (amount_hkd).
export const EXPENSE_CURRENCY = 'HKD';

export const EXPENSE_CURRENCIES: { code: string; label: string }[] = [
  { code: 'HKD', label: 'HKD - Hong Kong Dollar' },
  { code: 'CNY', label: 'CNY - Chinese Yuan (RMB)' },
  { code: 'MOP', label: 'MOP - Macau Pataca' },
  { code: 'TWD', label: 'TWD - Taiwan Dollar' },
  { code: 'JPY', label: 'JPY - Japanese Yen' },
  { code: 'KRW', label: 'KRW - Korean Won' },
  { code: 'SGD', label: 'SGD - Singapore Dollar' },
  { code: 'THB', label: 'THB - Thai Baht' },
  { code: 'AUD', label: 'AUD - Australian Dollar' },
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'GBP', label: 'GBP - British Pound' },
];

/** HKD reporting value of a claim/line (falls back to amount for legacy rows). */
export const claimHkd = (c: { amount: number; amountHkd?: number | null }): number =>
  c.amountHkd != null && Number.isFinite(c.amountHkd) ? (c.amountHkd as number) : c.amount;

/** True when the claim was made in a currency other than HKD. */
export const isForeignCurrency = (currency?: string | null): boolean =>
  !!currency && currency !== 'HKD';

/** FX rate as a compact display string: 7.8312 -> "7.8312", 7.8 -> "7.8". */
export const fxRateText = (rate?: number | null): string => {
  const r = Number(rate ?? 1);
  return Number.isFinite(r) ? String(parseFloat(r.toFixed(6))) : '1';
};

export const RECEIPT_MAX_MB = 5;
export const RECEIPT_ACCEPTED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
];

export const formatMoney = (amount: number, currency: string = EXPENSE_CURRENCY): string => {
  try {
    return new Intl.NumberFormat('en-HK', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

export const RATING_DESCRIPTIONS: Record<Rating, string> = {
  [Rating.SEE]: "Individual's results have significantly surpassed agreed goals, performance and contribution expectations.",
  [Rating.EE]: "Individual's results have more than achieved agreed goals, performance and contribution expectations.",
  [Rating.ME]: "Individual's results have achieved agreed goals, performance and contribution expectations.",
  [Rating.MSE]: "Individual's results are mixed but have achieved some agreed goals, performance and contribution expectations. Further development is necessary and improvements are expected.",
  [Rating.BE]: "Individual's results did not achieve a majority of agreed goals, performance and contribution expectations.",
  [Rating.NA]: "(If none of the ratings apply, select N/A)"
};

export const CORE_COMPETENCIES: Competency[] = [
  { id: 'comp-1', name: 'Work Effectiveness', description: 'Applies professional techniques and knowledge; plans work systematically; manages time effectively.', indicators: ['Applies job knowledge and technical skills effectively.', 'Observes deadlines and finishes tasks on time.', 'Completes assignments meeting quality and productivity standard.'] },
  { id: 'comp-2', name: 'Innovation & Change', description: 'Thinks creatively; supports changes; is open-minded.', indicators: ['Contributes new ideas.', 'Willing to try new ways.', 'Adjusts to changes.'] },
  { id: 'comp-3', name: 'Analysing & Decision Making', description: 'Analytical ability; understands root problems.', indicators: ['Analyses information.', 'Makes judgments with data.', 'Develops solutions.'] },
  { id: 'comp-4', name: 'Customer Focused', description: 'Driven to provide quality service.', indicators: ['Provides quality service.', 'Adapts to customer needs.'] },
  { id: 'comp-5', name: 'Results Orientation', description: 'Shows initiative; remains positive under pressure.', indicators: ['Sustains efforts.', 'Remains effective.', 'Seeks improvement.'] },
  { id: 'comp-6', name: 'Ownership', description: 'Trustworthy and consistent; upholds Group core values.', indicators: ['Follows core values.', 'Demonstrates commitment.', 'Takes accountability.'] }
];

export const INITIAL_KPIS: KPI[] = [
  { id: 'kpi-1', title: 'KPI 1', description: 'Defined by management.', startDate: '', targetDate: '', status: 'Active', midYearSelfComments: '', midYearManagerComments: '' },
  { id: 'kpi-2', title: 'KPI 2', description: 'Defined by management.', startDate: '', targetDate: '', status: 'Active', midYearSelfComments: '', midYearManagerComments: '' }
];

// Generates a collision-resistant ID like "mb-7x9z2k-3f2a"
const randomId = (length: number) => {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return uuid.slice(0, length);
};

export const createBlankAssessment = (
  name: string, 
  email: string, 
  managerName: string, 
  managerEmail: string, 
  kpiContents: string[],
  developmentGoal?: string,
  reviewType: 'mid-year' | 'final' = 'mid-year'
): Assessment => {
  return {
    id: `mb-${randomId(9)}`,
    employeeId: email,
    employeeDetails: {
      fullName: name,
      position: 'Staff Member',
      division: 'MetaBev',
      email: email,
    },
    managerName,
    managerEmail,
    // No passwords here: accounts are provisioned by supabase/import-users.mjs
    reviewType,
    kpis: kpiContents.map((content, idx) => ({
      id: `kpi-${idx}-${randomId(4)}`,
      title: `KPI ${idx + 1}`,
      description: content || 'Defined by management.',
      startDate: new Date().getFullYear().toString(),
      targetDate: new Date().getFullYear().toString(),
      status: 'Active',
      midYearSelfComments: '',
      midYearManagerComments: ''
    })),
    developmentPlan: { 
      developmentGoal: developmentGoal || 'To be defined by staff and manager.',
      competencies: [], 
      selfComments: '', 
      managerComments: '',
      midYearSelfComments: '',
      midYearManagerComments: ''
    },
    coreCompetencies: CORE_COMPETENCIES.map(c => ({ 
      ...c, 
      midYearSelfComments: '', 
      midYearManagerComments: '' 
    })),
    overallPerformance: { 
      selfComments: '', 
      managerComments: '',
      midYearSelfComments: '',
      midYearManagerComments: ''
    },
    status: 'draft'
  };
};
