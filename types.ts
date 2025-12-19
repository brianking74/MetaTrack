
export enum Rating {
  OUTSTANDING = '1 - Outstanding',
  EXCEEDED = '2 - Exceeded requirements',
  MODERATELY_EXCEEDED = '3M - Moderately exceeded requirements',
  MET = '3 - Met requirements',
  PARTIALLY_MET = '3P - Partially met requirements',
  MARGINAL = '4 - Marginal',
  UNACCEPTABLE = '5 - Unacceptable',
  NA = 'N/A'
}

export type Role = 'employee' | 'admin';

export interface KPI {
  id: string;
  title: string;
  description: string;
  startDate: string;
  targetDate: string;
  weight: number;
  status: string;
  selfRating?: Rating;
  selfComments?: string;
  managerRating?: Rating;
  managerComments?: string;
}

export interface Competency {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  selfRating?: Rating;
  managerRating?: Rating;
}

export interface EmployeeDetails {
  userId: string;
  fullName: string;
  position: string;
  grade: string;
  businessLine: string;
  division: string;
  location: string;
  lastHireDate: string;
}

export interface Assessment {
  id: string;
  employeeId: string;
  employeeDetails: EmployeeDetails;
  reviewPeriod: string;
  kpis: KPI[];
  developmentPlan: {
    competencies: string[];
    selfComments: string;
  };
  coreCompetencies: Competency[];
  overallPerformance: {
    selfRating?: Rating;
    selfComments: string;
    managerRating?: Rating;
    managerComments: string;
  };
  status: 'draft' | 'submitted' | 'reviewed';
  submittedAt?: string;
}
