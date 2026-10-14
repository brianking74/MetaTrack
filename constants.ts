
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
export const EXPENSES_ENABLED = false;

// Starter claim types (requirement: Entertainment, Travel & A&P).
// When the full official list of types + codes arrives, add entries here -
// the dropdown, filters and analytics all read from this single list.
export const EXPENSE_TYPES: { code: string; label: string }[] = [
  { code: 'ENT', label: 'Entertainment' },
  { code: 'TRV', label: 'Travel' },
  { code: 'AP',  label: 'A&P (Advertising & Promotion)' },
];

export const expenseTypeLabel = (code: string): string =>
  EXPENSE_TYPES.find(t => t.code === code)?.label || code;

export const EXPENSE_CURRENCY = 'HKD';
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
