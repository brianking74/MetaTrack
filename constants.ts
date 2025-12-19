
import { Rating, Competency, KPI } from './types.ts';

export const RATING_DESCRIPTIONS: Record<Rating, string> = {
  [Rating.NA]: 'Not Applicable',
  [Rating.OUTSTANDING]: 'The performance far exceeded the requirements of all acknowledged KPIs.',
  [Rating.EXCEEDED]: 'The performance exceeded the requirements of all acknowledged KPIs.',
  [Rating.MODERATELY_EXCEEDED]: 'The performance met the requirements and even exceeded some of them.',
  [Rating.MET]: 'The performance met the requirements of all acknowledged KPIs.',
  [Rating.PARTIALLY_MET]: 'The performance met the requirements of some acknowledged KPIs.',
  [Rating.MARGINAL]: 'The performance was below requirements.',
  [Rating.UNACCEPTABLE]: 'The performance was significantly below requirements.'
};

export const INITIAL_KPIS: KPI[] = [
  {
    id: 'kpi-1',
    title: 'KPI 1: Strategic Goal',
    description: 'Enter your first strategic objective here...',
    startDate: '',
    targetDate: '',
    status: '',
    midYearSelfComments: '',
    midYearManagerComments: ''
  },
  {
    id: 'kpi-2',
    title: 'KPI 2: Operational Goal',
    description: 'Enter your second operational objective here...',
    startDate: '',
    targetDate: '',
    status: '',
    midYearSelfComments: '',
    midYearManagerComments: ''
  }
];

export const CORE_COMPETENCIES: Competency[] = [
  {
    id: 'comp-1',
    name: 'Work Effectiveness',
    description: 'Applies professional techniques and knowledge; plans work systematically; manages time effectively.',
    indicators: [
      'Applies job knowledge and technical skills effectively.',
      'Observes deadlines and finishes tasks on time.',
      'Completes assignments meeting quality and productivity standard.',
      'Serves as a source of technical reference for team members.'
    ]
  },
  {
    id: 'comp-2',
    name: 'Innovation, Adapting & Responding to Change',
    description: 'Thinks creatively; supports changes; is open-minded and willing to adjust.',
    indicators: [
      'Contributes new ideas to improve workflow.',
      'Willing to try out new ways of handling issues.',
      'Adjusts to comply with changes in policies or strategies.',
      'Engages team members to implement solutions.'
    ]
  },
  {
    id: 'comp-3',
    name: 'Analysing, Decision Making & Problem Solving',
    description: 'Demonstrates analytical ability; understands root problems; makes thorough decisions.',
    indicators: [
      'Analyses numerical and verbal information.',
      'Makes judgments with supporting data.',
      'Develops solutions in own area.',
      'Organises resources to solve problems.'
    ]
  },
  {
    id: 'comp-4',
    name: 'Customer Focused',
    description: 'Driven to provide quality service; understands and adapts to customer needs.',
    indicators: [
      'Provides quality service to internal/external customers.',
      'Adapts to changing customer needs.',
      'Communicates regularly and responds timely.',
      'Facilitates team members to implement focused practices.'
    ]
  },
  {
    id: 'comp-5',
    name: 'Drive & Results Orientation',
    description: 'Shows initiative; remains positively minded under pressure; strives for excellence.',
    indicators: [
      'Sustains efforts to achieve assignments.',
      'Remains effective in demanding situations.',
      'Seeks continuous performance improvement.',
      'Drives self and team to achieve work results.'
    ]
  },
  {
    id: 'comp-6',
    name: 'Ownership & Commitment',
    description: 'Is trustworthy and consistent; upholds professionalism and Group core values.',
    indicators: [
      'Follows core values and professional ethics.',
      'Demonstrates commitment and positive attitudes.',
      'Takes accountability for decisions.',
      'Considers Group credibility in decisions.'
    ]
  }
];
