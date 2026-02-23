
import { Rating, Competency, KPI, Assessment } from './types.ts';

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

export const createBlankAssessment = (
  name: string, 
  email: string, 
  managerName: string, 
  managerEmail: string, 
  kpiContents: string[],
  managerPassword?: string
): Assessment => {
  return {
    // Generates a string ID like "mb-7x9z2k"
    id: `mb-${Math.random().toString(36).substr(2, 9)}`,
    employeeId: email,
    employeeDetails: {
      fullName: name,
      position: 'Staff Member',
      division: 'MetaBev',
      email: email,
    },
    managerName,
    managerEmail,
    managerPassword: managerPassword || 'metabev2025', // Default if not provided
    kpis: kpiContents.map((content, idx) => ({
      id: `kpi-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      title: `KPI ${idx + 1}`,
      description: content || 'Defined by management.',
      startDate: new Date().getFullYear().toString(),
      targetDate: new Date().getFullYear().toString(),
      status: 'Active',
      midYearSelfComments: '',
      midYearManagerComments: ''
    })),
    developmentPlan: { competencies: [], selfComments: '', managerComments: '' },
    coreCompetencies: CORE_COMPETENCIES.map(c => ({ ...c })),
    overallPerformance: { selfComments: '', managerComments: '' },
    status: 'draft'
  };
};
