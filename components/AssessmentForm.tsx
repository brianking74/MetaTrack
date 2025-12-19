
import React, { useState, useEffect } from 'react';
import { Assessment, Rating, KPI, Competency } from '../types.ts';
import { RATING_DESCRIPTIONS, INITIAL_KPIS, CORE_COMPETENCIES } from '../constants.ts';

interface AssessmentFormProps {
  initialData?: Assessment;
  onSave: (data: Assessment) => void;
  onSubmit: (data: Assessment) => void;
}

const STAGES = [
  'Overview',
  'Key Performance Indicators',
  'Individual Development',
  'Core Competencies',
  'Final Review'
];

const AssessmentForm: React.FC<AssessmentFormProps> = ({ initialData, onSave, onSubmit }) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [formData, setFormData] = useState<Assessment>(initialData || {
    id: Math.random().toString(36).substr(2, 9),
    employeeId: '',
    employeeDetails: {
      userId: '',
      fullName: '',
      position: '',
      grade: '',
      businessLine: '',
      division: '',
      location: '',
      lastHireDate: ''
    },
    reviewPeriod: '',
    kpis: INITIAL_KPIS,
    developmentPlan: { competencies: [], selfComments: '' },
    coreCompetencies: CORE_COMPETENCIES,
    overallPerformance: { selfComments: '', managerComments: '' },
    status: 'draft'
  });

  const saveToDraft = () => {
    onSave(formData);
  };

  const handleNext = () => {
    saveToDraft();
    if (currentStage < STAGES.length - 1) setCurrentStage(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentStage > 0) setCurrentStage(prev => prev - 1);
  };

  const updateKPI = (id: string, updates: Partial<KPI>) => {
    setFormData(prev => ({
      ...prev,
      kpis: prev.kpis.map(k => k.id === id ? { ...k, ...updates } : k)
    }));
  };

  const updateCompetency = (id: string, updates: Partial<Competency>) => {
    setFormData(prev => ({
      ...prev,
      coreCompetencies: prev.coreCompetencies.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const handleDetailChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      employeeDetails: { ...prev.employeeDetails, [key]: value }
    }));
  };

  const renderRatingSelect = (currentRating: Rating | undefined, onChange: (r: Rating) => void) => (
    <div className="space-y-2">
      <select 
        value={currentRating || ''} 
        onChange={(e) => onChange(e.target.value as Rating)}
        className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
      >
        <option value="" disabled>Select Rating</option>
        {Object.values(Rating).map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      {currentRating && (
        <p className="text-xs text-slate-500 italic">{RATING_DESCRIPTIONS[currentRating]}</p>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Progress Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-medium text-slate-500">Stage {currentStage + 1} of {STAGES.length}</span>
          <span className="text-sm font-bold text-brand-600 uppercase tracking-tight">{STAGES[currentStage]}</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className="bg-brand-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${((currentStage + 1) / STAGES.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="p-8">
        {/* Stage 1: Overview */}
        {currentStage === 0 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Employee Overview</h3>
            <p className="text-sm text-slate-500 mb-4">Please fill in your current employment details for this review cycle.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {Object.entries(formData.employeeDetails).map(([key, value]) => (
                <div key={key} className="flex flex-col border-b border-slate-50 pb-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleDetailChange(key, e.target.value)}
                    placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
                    className="text-slate-700 font-medium bg-transparent border-none focus:ring-0 p-0 outline-none"
                  />
                </div>
              ))}
              <div className="flex flex-col border-b border-slate-50 pb-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Review Period</label>
                <input
                  type="text"
                  value={formData.reviewPeriod}
                  onChange={(e) => setFormData(prev => ({ ...prev, reviewPeriod: e.target.value }))}
                  placeholder="e.g. 01/01/2023 - 31/12/2023"
                  className="text-slate-700 font-medium bg-transparent border-none focus:ring-0 p-0 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Stage 2: KPIs */}
        {currentStage === 1 && (
          <div className="space-y-10">
            {formData.kpis.map((kpi, idx) => (
              <div key={kpi.id} className="p-6 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 mr-4">
                    <input 
                      type="text"
                      value={kpi.title}
                      onChange={(e) => updateKPI(kpi.id, { title: e.target.value })}
                      className="text-lg font-bold text-slate-800 bg-transparent border-none focus:ring-0 p-0 w-full outline-none"
                      placeholder="Goal Title"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Weight:</span>
                    <input 
                      type="number"
                      value={kpi.weight}
                      onChange={(e) => updateKPI(kpi.id, { weight: parseInt(e.target.value) || 0 })}
                      className="w-12 text-center text-xs font-bold bg-white border border-slate-200 rounded p-1"
                    />
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </div>
                </div>
                <textarea 
                  value={kpi.description}
                  onChange={(e) => updateKPI(kpi.id, { description: e.target.value })}
                  className="w-full text-slate-600 text-sm mb-6 bg-white p-3 rounded border border-slate-100 italic outline-none resize-none"
                  placeholder="Describe the objective and target results..."
                  rows={2}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700">Self Rating</label>
                    {renderRatingSelect(kpi.selfRating, (r) => updateKPI(kpi.id, { selfRating: r }))}
                  </div>
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700">Achievement & Progress Comments</label>
                    <textarea 
                      value={kpi.selfComments || ''}
                      onChange={(e) => updateKPI(kpi.id, { selfComments: e.target.value })}
                      className="w-full border border-slate-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none h-32"
                      placeholder="Detail your results and achievements for this period..."
                    />
                  </div>
                </div>
              </div>
            ))}
            <button 
              onClick={() => setFormData(prev => ({
                ...prev,
                kpis: [...prev.kpis, { id: Math.random().toString(36).substr(2, 9), title: `KPI ${prev.kpis.length + 1}`, description: '', weight: 0, status: '', startDate: '', targetDate: '' }]
              }))}
              className="text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-2"
            >
              + Add Another KPI
            </button>
          </div>
        )}

        {/* Stage 3: Development Plan */}
        {currentStage === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800">Self-Individual Development</h3>
            <p className="text-sm text-slate-500">Reflect on your growth and key competencies you've worked on (e.g., People Management, Customer Focus).</p>
            <textarea 
              value={formData.developmentPlan.selfComments}
              onChange={(e) => setFormData(prev => ({ ...prev, developmentPlan: { ...prev.developmentPlan, selfComments: e.target.value } }))}
              className="w-full border border-slate-300 rounded-lg p-4 text-sm focus:ring-2 focus:ring-brand-500 outline-none h-64"
              placeholder="What specific skills or knowledge did you focus on developing this year? How did you apply them?"
            />
          </div>
        )}

        {/* Stage 4: Core Competencies */}
        {currentStage === 3 && (
          <div className="space-y-8">
            {formData.coreCompetencies.map((comp, idx) => (
              <div key={comp.id} className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm">
                <h4 className="text-lg font-bold text-slate-800 mb-2">{idx + 1}. {comp.name}</h4>
                <p className="text-sm text-slate-500 mb-4">{comp.description}</p>
                
                <div className="bg-slate-50 p-4 rounded mb-6">
                  <span className="text-xs font-bold text-slate-400 uppercase mb-2 block">Behavioural Indicators</span>
                  <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                    {comp.indicators.map((ind, i) => <li key={i}>{ind}</li>)}
                  </ul>
                </div>

                <div className="max-w-md">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Self Assessment Rating</label>
                  {renderRatingSelect(comp.selfRating, (r) => updateCompetency(comp.id, { selfRating: r }))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stage 5: Final Review */}
        {currentStage === 4 && (
          <div className="space-y-8">
             <div className="bg-brand-50 border border-brand-100 p-6 rounded-lg text-brand-800">
               <h3 className="text-lg font-bold mb-2">Ready to Submit?</h3>
               <p className="text-sm">Please provide a summary of your overall performance for the review period. Once submitted, your manager will review your self-assessment and provide the final evaluation.</p>
             </div>

             <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">Overall Self-Appraisal Summary</label>
                <textarea 
                  value={formData.overallPerformance.selfComments}
                  onChange={(e) => setFormData(prev => ({ ...prev, overallPerformance: { ...prev.overallPerformance, selfComments: e.target.value } }))}
                  className="w-full border border-slate-300 rounded-lg p-4 text-sm focus:ring-2 focus:ring-brand-500 outline-none h-48"
                  placeholder="Summarize your key highlights, challenges overcome, and vision for the next review period..."
                />
             </div>

             <div className="max-w-md">
                <label className="block text-sm font-bold text-slate-700 mb-2">Suggested Overall Performance Rating</label>
                {renderRatingSelect(formData.overallPerformance.selfRating, (r) => setFormData(prev => ({ ...prev, overallPerformance: { ...prev.overallPerformance, selfRating: r } })))}
             </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-12 flex justify-between pt-6 border-t border-slate-100">
          <button 
            onClick={handlePrev}
            disabled={currentStage === 0}
            className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${
              currentStage === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Previous
          </button>
          
          <div className="flex gap-4">
            <button 
              onClick={saveToDraft}
              className="px-6 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md font-medium text-sm transition-all border border-slate-200"
            >
              Save Draft
            </button>
            {currentStage === STAGES.length - 1 ? (
              <button 
                onClick={() => onSubmit(formData)}
                className="px-8 py-2 bg-brand-600 text-white hover:bg-brand-700 rounded-md font-bold text-sm shadow-md transition-all ring-offset-2 focus:ring-2 focus:ring-brand-500"
              >
                Submit Appraisal
              </button>
            ) : (
              <button 
                onClick={handleNext}
                className="px-8 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-md font-bold text-sm shadow-md transition-all"
              >
                Next Section
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentForm;
