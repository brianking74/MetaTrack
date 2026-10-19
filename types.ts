
export enum Rating {
  SEE = '(1) SEE - Substantially Exceeding Expectations',
  EE = '(2) EE - Exceeding Expectations',
  ME = '(3) ME - Meeting Expectations',
  MSE = '(4) MSE - Meeting Some Expectations',
  BE = '(5) BE - Below Expectations',
  NA = '(6) N/A - Not Applicable'
}

export type RoleType = 'staff' | 'manager' | 'admin';
export type ReviewType = 'mid-year' | 'final';

// Claim lifecycle:
//   submitted  - waiting for the line manager's decision
//   pending_gm - approved by the line manager, waiting for the General
//                Manager's final approval (only the GM can move it on)
//   approved   - final approval given by the GM; finance pays
//   rejected   - not approved (by line manager or GM); staff resubmits
export type ExpenseClaimStatus = 'submitted' | 'pending_gm' | 'approved' | 'rejected';

export interface ExpenseClaim {
  id: string;
  email: string;            // claimant (staff) email, lowercase
  staffName: string;
  managerEmail: string;     // approver email, lowercase
  managerName?: string;
  expenseType: string;      // code from EXPENSE_TYPES, e.g. 'ENT'
  expenseDate: string;      // ISO date (yyyy-mm-dd)
  description: string;
  amount: number;
  currency: string;         // 'HKD' or any EXPENSE_CURRENCIES code
  fxRate?: number;          // HKD per 1 unit of currency (1 for HKD)
  amountHkd?: number;       // HKD reporting value = amount * fxRate
  customerName?: string;    // optional customer/client the expense was for
  budgetCode?: string;      // optional brand budget code, e.g. 'EST008'
  receiptPath: string;      // storage path: <email>/<claim id>/<file>
  receiptName: string;
  receiptType: string;      // mime type
  status: ExpenseClaimStatus;
  // Groups the lines of one submission into a single claim: every row
  // submitted in the same "Add More" batch shares one claim_group_id, so
  // the manager approves/rejects the whole claim and finance gets ONE
  // itemised email. Null for rows submitted before claim groups existed
  // (those stand alone as their own claim).
  claimGroupId?: string | null;
  // General Manager (second) approval stage. gmEmail is stamped on every
  // row at submission time so RLS can route the GM queue without needing
  // app-level config lookups.
  gmEmail?: string;
  reviewComment?: string;     // comment recorded at the LINE MANAGER stage
  gmComment?: string;         // comment recorded at the GM stage
  reviewedBy?: string;        // who made the FINAL decision (GM, or line manager on outright reject)
  reviewedAt?: string;
  managerReviewedBy?: string; // line manager who approved (stage 1 audit trail)
  managerReviewedAt?: string;
  financeNotifiedAt?: string;
  createdAt: string;
}

export interface KPI {
  id: string;
  title: string;
  description: string;
  startDate: string;
  targetDate: string;
  status: string;
  selfRating?: Rating;
  selfComments?: string;
  managerRating?: Rating;
  managerComments?: string;
  midYearSelfComments?: string;
  midYearManagerComments?: string;
}

export interface Competency {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  selfRating?: Rating;
  managerRating?: Rating;
  managerComments?: string;
  midYearSelfComments?: string;
  midYearManagerComments?: string;
}

export interface EmployeeDetails {
  fullName: string;
  position: string;
  division: string;
  email: string;
}

export interface Assessment {
  id: string;
  employeeId: string;
  employeeDetails: EmployeeDetails;
  managerName: string;
  managerEmail: string;
  // NOTE: passwords are NOT stored here anymore. Since the Supabase Auth
  // migration they live only as salted hashes inside Supabase Auth.
  reviewType: ReviewType;
  kpis: KPI[];
  developmentPlan: {
    developmentGoal: string;
    competencies: string[];
    selfComments: string;
    managerComments?: string;
    midYearSelfComments?: string;
    midYearManagerComments?: string;
  };
  coreCompetencies: Competency[];
  overallPerformance: {
    selfRating?: Rating;
    selfComments: string;
    managerRating?: Rating;
    managerComments: string;
    midYearSelfComments?: string;
    midYearManagerComments?: string;
  };
  status: 'draft' | 'submitted' | 'reviewed';
  midYearStatus?: 'draft' | 'submitted' | 'reviewed';
  midYearSubmittedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  updatedAt?: string;
}
