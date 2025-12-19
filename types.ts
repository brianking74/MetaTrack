
export enum Rating {
  NA = 'N/A - Not Applicable',
  OUTSTANDING = '1 - Outstanding',
  EXCEEDS = '2 - Exceeds requirements',
  MEETS = '3 - Meets requirements',
  PARTIALLY_MEETS = '4 - Partially meets requirements',
  NOT_MET = '5 - Requirements not met'
}

export type Role = 'employee' | 'admin';

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
}

export interface EmployeeDetails {
  fullName: string;
  position: string;
  division: string;
}

export interface Assessment {
  id: string;
  employeeId: string;
  employeeDetails: EmployeeDetails;
  kpis: KPI[];
  developmentPlan: {
    competencies: string[];
    selfComments: string;
    managerComments?: string;
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
