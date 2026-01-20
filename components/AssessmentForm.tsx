
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
  // Initializing state with default values if initialData is not provided.
  // Fixed: Added missing managerName and managerEmail fields and cast empty competencies array to string[].
  const [formData, setFormData] = useState<Assessment>(initialData || {
    id: Math.random().toString(36).substr(2, 9),
    employeeId: '',
    employeeDetails: { fullName: '', position: '', division: '', email: '' },
    managerName: '',
    managerEmail: '',
    kpis: INITIAL_KPIS,
    developmentPlan: { competencies: [] as string[], selfComments: '', managerComments: '' },
    coreCompetencies: CORE_COMPETENCIES,
    overallPerformance: { selfComments: '', managerComments: '' },
    status: 'draft'
  });

  // Ensure user is scrolled to top when switching stages
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStage]);

  const isReadOnly = formData.status !== 'draft';

  const saveToDraft = () => {
    if (isReadOnly) return;
    onSave({ ...formData, updatedAt: new Date().toISOString() });
  };

  const handleNext = () => {
    saveToDraft();
    if (currentStage < STAGES.length - 1) setCurrentStage(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentStage > 0) setCurrentStage(prev => prev - 1);
  };

  const updateKPI = (id: string, updates: Partial<KPI>) => {
    if (isReadOnly) return;
    setFormData(prev => ({
      ...prev,
      kpis: prev.kpis.map(k => k.id === id ? { ...k, ...updates } : k)
    }));
  };

  const updateCompetency = (id: string, updates: Partial<Competency>) => {
    if (isReadOnly) return;
    setFormData(prev => ({
      ...prev,
      coreCompetencies: prev.coreCompetencies.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const handleDetailChange = (key: string, value: string) => {
    if (isReadOnly) return;
    setFormData(prev => ({
      ...prev,
      employeeDetails: { ...prev.employeeDetails, [key]: value }
    }));
  };

  const renderRatingSelect = (currentRating: Rating | undefined, onChange: (r: Rating) => void, isDisabled: boolean = false) => (
    <div className="space-y-2">
      <select 
        value={currentRating || ''} 
        onChange={(e) => onChange(e.target.value as Rating)}
        disabled={isDisabled || isReadOnly}
        className={`w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none ${(isDisabled || isReadOnly) ? 'bg-slate-100 text-slate-500 cursor-not-allowed opacity-70' : 'bg-white'}`}
      >
        <option value="" disabled>Select Rating</option>
        {Object.values(Rating).map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      {currentRating && (
        <p className="text-[10px] text-slate-500 italic mt-1 leading-tight">{RATING_DESCRIPTIONS[currentRating]}</p>
      )}
    </div>
  );

  const SectionBadge = ({ text, type = 'self' }: { text: string, type?: 'self' | 'manager' }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider mb-2 ${
      type === 'self' ? 'bg-brand-100 text-brand-700' : 'bg-slate-900 text-white'
    }`}>
      {text}
    </span>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
        {currentStage === 0 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Employee Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {Object.entries(formData.employeeDetails).map(([key, value]) => (
                <div key={key} className="flex flex-col border-b border-slate-50 pb-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type={key === 'email' ? 'email' : 'text'}
                    value={value}
                    readOnly={key === 'email' || isReadOnly}
                    onChange={(e) => handleDetailChange(key, e.target.value)}
                    className={`text-slate-700 font-medium bg-transparent border-none focus:ring-0 p-0 outline-none ${(key === 'email' || isReadOnly) ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStage === 1 && (
          <div className="space-y-16">
            {formData.kpis.map((kpi, idx) => (
              <div key={kpi.id} className="p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                <div className="flex justify-between items-start mb-6">
                   <h4 className="text-2xl font-black text-slate-900 tracking-tight">{kpi.title}</h4>
                   <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em] bg-brand-50 px-3 py-1 rounded-full border border-brand-100">Core Goal</span>
                </div>
                
                <div className="mb-10">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 opacity-60">KPI Description</span>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 text-sm text-slate-700 leading-relaxed italic shadow-inner">
                    {kpi.description}
                  </div>
                </div>
                
                <div className="space-y-10">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 border-b pb-2">Annual Self-Appraisal</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                      <SectionBadge text="Self Rating" />
                      {renderRatingSelect(kpi.selfRating, (r) => updateKPI(kpi.id, { selfRating: r }))}
                    </div>
                    <div className="md:col-span-2 space-y-4">
                      <SectionBadge text="Achievement Comments" />
                      <textarea 
                        value={kpi.selfComments || ''}
                        readOnly={isReadOnly}
                        onChange={(e) => updateKPI(kpi.id, { selfComments: e.target.value })}
                        className={`w-full border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand-500 outline-none h-32 shadow-sm ${isReadOnly ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                        placeholder="Describe your actual performance against this KPI..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {currentStage === 2 && (
          <div className="space-y-12">
            <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Individual Development</h3>
            <div className="space-y-8">
              <div className="space-y-2">
                <SectionBadge text="Staff Self-Reflection" />
                <textarea 
                  value={formData.developmentPlan.selfComments}
                  readOnly={isReadOnly}
                  onChange={(e) => setFormData(prev => ({ ...prev, developmentPlan: { ...prev.developmentPlan, selfComments: e.target.value } }))}
                  className={`w-full border border-slate-300 rounded-3xl p-6 text-sm focus:ring-2 focus:ring-brand-500 outline-none h-64 shadow-sm ${isReadOnly ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  placeholder="Reflect on your growth during this cycle..."
                />
              </div>
            </div>
          </div>
        )}

        {currentStage === 3 && (
          <div className="space-y-8">
            {formData.coreCompetencies.map((comp, idx) => (
              <div key={comp.id} className="p-8 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
                <h4 className="text-xl font-black text-slate-800 mb-2">{idx + 1}. {comp.name}</h4>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">{comp.description}</p>
                <div className="max-w-md">
                  <SectionBadge text="Self-Rating" />
                  {renderRatingSelect(comp.selfRating, (r) => updateCompetency(comp.id, { selfRating: r }))}
                </div>
              </div>
            ))}
          </div>
        )}

        {currentStage === 4 && (
          <div className="space-y-10">
             <div className="bg-brand-900 text-white p-10 rounded-[2.5rem] shadow-xl">
               <h3 className="text-2xl font-bold mb-3">Staff Submission Summary</h3>
               <p className="text-sm opacity-80 leading-relaxed">Provide a final overview of your annual performance highlights.</p>
             </div>
             <div className="space-y-8">
                <div className="space-y-2">
                  <SectionBadge text="Overall Achievement Narrative" />
                  <textarea 
                    value={formData.overallPerformance.selfComments}
                    readOnly={isReadOnly}
                    onChange={(e) => setFormData(prev => ({ ...prev, overallPerformance: { ...prev.overallPerformance, selfComments: e.target.value } }))}
                    className={`w-full border border-slate-300 rounded-[2.5rem] p-8 text-sm focus:ring-2 focus:ring-brand-500 outline-none h-64 shadow-md ${isReadOnly ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    placeholder="Summarize your key highlights..."
                  />
                </div>
                <div className="max-w-md space-y-2">
                  <SectionBadge text="Suggested Performance Grade" />
                  {renderRatingSelect(formData.overallPerformance.selfRating, (r) => setFormData(prev => ({ ...prev, overallPerformance: { ...prev.overallPerformance, selfRating: r } })))}
                </div>
             </div>
          </div>
        )}

        <div className="mt-12 flex justify-between pt-8 border-t border-slate-100">
          <button 
            onClick={handlePrev}
            disabled={currentStage === 0}
            className={`px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
              currentStage === 0 ? 'text-slate-300 cursor-not-allowed border-transparent' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            Back
          </button>
          
          <div className="flex gap-4">
            {!isReadOnly && (
              <button 
                onClick={saveToDraft}
                className="px-8 py-3 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
              >
                Save Draft
              </button>
            )}
            {currentStage === STAGES.length - 1 ? (
              !isReadOnly ? (
                <button 
                  onClick={() => {
                    if (confirm("Submit your self-appraisal? This action will finalize your input for manager review.")) {
                      onSubmit({ ...formData, submittedAt: new Date().toISOString() });
                    }
                  }}
                  className="px-12 py-3 bg-brand-600 text-white hover:bg-brand-700 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg transition-all transform active:scale-95"
                >
                  Submit Now
                </button>
              ) : (
                <div className="px-8 py-3 bg-slate-100 text-slate-400 rounded-xl font-black text-xs uppercase tracking-[0.2em] border flex items-center gap-2">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                   Submitted
                </div>
              )
            ) : (
              <button 
                onClick={handleNext}
                className="px-10 py-3 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg"
              >
                Next Step
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentForm;
