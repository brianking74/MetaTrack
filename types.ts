
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

export type ExpenseClaimStatus = 'submitted' | 'approved' | 'rejected';

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
  currency: string;         // 'HKD'
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
  reviewComment?: string;
  reviewedBy?: string;
  reviewedAt?: string;
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
