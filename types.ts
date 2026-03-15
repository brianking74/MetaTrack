
export enum Rating {
  SEE = '(1) SEE - Substantially Exceeding Expectations',
  EE = '(2) EE - Exceeding Expectations',
  ME = '(3) ME - Meeting Expectations',
  MSE = '(4) MSE - Meeting Some Expectations',
  BE = '(5) BE - Below Expectations',
  NA = '(6) N/A - Not Applicable'
}

export type RoleType = 'staff' | 'manager' | 'admin';

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
  managerPassword?: string;
  employeePassword?: string;
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
