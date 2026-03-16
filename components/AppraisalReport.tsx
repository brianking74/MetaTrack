
import React, { useState, useRef, useEffect } from 'react';
import { Assessment, Rating } from '../types.ts';
import { analyzeAssessment } from '../services/geminiService.ts';
import DebouncedTextarea from './DebouncedTextarea.tsx';

interface AppraisalReportProps {
  assessment: Assessment;
  isEditable: boolean;
  onUpdate?: (updated: Assessment, immediate?: boolean) => void;
  onFinalize?: (final: Assessment) => void;
  isDownloading?: boolean;
}

const SectionTitle = ({ children, colorClass = "border-brand-600" }: { children?: React.ReactNode, colorClass?: string }) => (
  <h4 className={`text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-8 border-l-4 ${colorClass} pl-4`}>
    {children}
  </h4>
);

const AppraisalReport: React.FC<AppraisalReportProps> = ({ 
  assessment, 
  isEditable, 
  onUpdate, 
  onFinalize,
  isDownloading 
}) => {
  const assessmentRef = useRef(assessment);
  
  useEffect(() => {
    assessmentRef.current = assessment;
  }, [assessment]);

  const handleUpdate = (updated: Assessment, immediate = false) => {
    assessmentRef.current = updated;
    onUpdate?.(updated, immediate);
  };

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const validateMidYearFeedback = () => {
    const missingKPIs = assessmentRef.current.kpis.some(k => !k.midYearManagerComments?.trim());
    const missingDev = !assessmentRef.current.developmentPlan.midYearManagerComments?.trim();
    const missingOverall = !assessmentRef.current.overallPerformance.midYearManagerComments?.trim();

    if (missingKPIs || missingDev || missingOverall) {
      alert("Please ensure you have answered all questions before moving to the next stage.");
      return false;
    }
    return true;
  };

  const validateFinalReview = () => {
    const missingKPIs = assessmentRef.current.kpis.some(k => !k.managerRating || !k.managerComments?.trim());
    const missingDev = !assessmentRef.current.developmentPlan.managerComments?.trim();
    const missingComps = assessmentRef.current.coreCompetencies.some(c => !c.managerRating || !c.managerComments?.trim());
    const missingOverall = !assessmentRef.current.overallPerformance.managerRating || !assessmentRef.current.overallPerformance.managerComments?.trim();

    if (missingKPIs || missingDev || missingComps || missingOverall) {
      alert("Please ensure you have answered all questions before moving to the next stage.");
      return false;
    }
    return true;
  };

  const isFinalReviewLocked = isEditable && assessment.midYearStatus === 'submitted' && assessment.status !== 'submitted';

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const insight = await analyzeAssessment(assessment);
      setAiInsight(insight);
    } catch (err) {
      alert("AI analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderRatingSelect = (currentRating: Rating | undefined, onChange: (r: Rating) => void) => (
    <select 
      value={currentRating || ''} 
      onChange={(e) => onChange(e.target.value as Rating)}
      className="w-full max-w-xs border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white"
    >
      <option value="" disabled>Select Rating</option>
      {Object.values(Rating).map(r => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );

  return (
    <div id="appraisal-report" className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
      <div className="border-b pb-8 mb-12 flex justify-between items-start">
        <div>
          <h3 className="text-4xl font-black text-slate-900 leading-tight">{assessment.employeeDetails.fullName}</h3>
          <p className="text-sm font-medium text-brand-600">{assessment.employeeDetails.email}</p>
          <div className="mt-4 flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>Manager: {assessment.managerName}</span>
            <span className="opacity-40">|</span>
            <span>Role: {assessment.employeeDetails.position}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${assessment.status === 'reviewed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'} no-print`}>
            {assessment.status}
          </span>
          {assessment.reviewedAt && (
             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest no-print">Finalized: {new Date(assessment.reviewedAt).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      <div className="space-y-24">
        {/* KPIs Section */}
        <section>
          <div className="flex justify-between items-center mb-8">
            <SectionTitle>Key Performance Indicators</SectionTitle>
            {isEditable && !aiInsight && (
              <button onClick={handleAiAnalysis} disabled={isAnalyzing} className="text-[10px] font-black uppercase tracking-widest text-brand-600 border border-brand-200 px-4 py-2 rounded-full hover:bg-brand-50 transition-all flex items-center gap-2">
                {isAnalyzing ? 'Analyzing...' : '✨ AI Insight'}
              </button>
            )}
          </div>
          <div className="space-y-16">
            {assessment.kpis.map((kpi, idx) => (
              <div key={kpi.id} className="p-8 md:p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100 break-inside-avoid">
                <div className="flex justify-between items-start mb-4">
                  <h5 className="text-2xl font-black text-slate-900">{kpi.title}</h5>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Goal {idx + 1}</span>
                </div>
                
                <div className="mb-10">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2 opacity-60">KPI Description</span>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 text-sm text-slate-700 leading-normal italic shadow-inner">
                    {kpi.description}
                  </div>
                </div>

                {(kpi.midYearSelfComments || kpi.midYearManagerComments || isFinalReviewLocked) && (
                  <div className="mb-10 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 block">Mid-Year Review</span>
                      {isFinalReviewLocked && (
                        <span className="text-[8px] font-bold text-blue-400 uppercase tracking-tight bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Review Mode</span>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="bg-blue-50/30 p-5 rounded-2xl border border-blue-100 text-sm text-slate-700 leading-normal italic">
                        <span className="text-[8px] font-bold text-blue-400 uppercase block mb-1">Staff Reflection</span>
                        {kpi.midYearSelfComments ? `"${kpi.midYearSelfComments}"` : <span className="text-slate-400 italic">No reflection provided.</span>}
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-blue-100 text-sm text-slate-700 leading-normal shadow-sm">
                        <span className="text-[8px] font-bold text-blue-400 uppercase block mb-1">Manager Mid-Year Feedback</span>
                        {!isEditable ? (
                          <p className="italic text-slate-500">{kpi.midYearManagerComments || 'No feedback provided.'}</p>
                        ) : (
                          <DebouncedTextarea 
                            value={kpi.midYearManagerComments || ''} 
                            onChange={(val) => handleUpdate({...assessmentRef.current, kpis: assessmentRef.current.kpis.map(k => k.id === kpi.id ? {...k, midYearManagerComments: val} : k)})}
                            className="w-full text-xs border-none p-0 bg-transparent outline-none h-20 resize-none focus:ring-0"
                            placeholder="Enter mid-year feedback for this KPI..."
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className={`space-y-10 ${isFinalReviewLocked ? 'opacity-50 grayscale pointer-events-none select-none' : ''}`}>
                  <h6 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.4em] mb-6">Final Review</h6>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                       <span className="text-[9px] font-black uppercase tracking-widest text-brand-600">Staff Rating</span>
                       <div className="p-3 bg-white border rounded-xl text-sm font-bold text-slate-700">{kpi.selfRating ? kpi.selfRating.split(' - ')[0] : 'N/A'}</div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <span className="text-[9px] font-black uppercase tracking-widest text-brand-600">Staff Comments</span>
                       <div className="p-4 bg-white border rounded-xl text-xs text-slate-600 italic">
                         {kpi.selfComments ? `"${kpi.selfComments}"` : <span className="text-slate-300 italic">No comments provided.</span>}
                       </div>
                    </div>
                  </div>
                  <div className="pt-10 mt-10 border-t-2 border-slate-200 bg-white p-8 rounded-[2rem] border-2 shadow-sm break-inside-avoid">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-600">Manager Rating</span>
                        {!isEditable ? (
                           <div className="p-3 bg-slate-50 border rounded-xl text-sm font-bold text-slate-800">{kpi.managerRating ? kpi.managerRating.split(' - ')[0] : 'N/A'}</div>
                        ) : (
                           renderRatingSelect(kpi.managerRating, (r) => handleUpdate({...assessmentRef.current, kpis: assessmentRef.current.kpis.map(k => k.id === kpi.id ? {...k, managerRating: r} : k)}))
                        )}
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-600">Manager Comments</span>
                        {!isEditable ? (
                           <div className="p-5 bg-slate-50 border rounded-2xl text-xs text-slate-700 italic leading-normal">{kpi.managerComments || ''}</div>
                        ) : (
                           <DebouncedTextarea 
                          value={kpi.managerComments || ''} 
                          onChange={(val) => handleUpdate({...assessmentRef.current, kpis: assessmentRef.current.kpis.map(k => k.id === kpi.id ? {...k, managerComments: val} : k)})} 
                          className="w-full text-xs border rounded-2xl p-5 h-36 outline-none bg-slate-50/50 focus:ring-2 focus:ring-brand-500 leading-normal" 
                          placeholder="Evaluate performance..." 
                        />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Competencies Section */}
        <section>
          <SectionTitle colorClass="border-slate-400">Core Competencies</SectionTitle>
          <div className={`space-y-12 ${isFinalReviewLocked ? 'opacity-50 grayscale pointer-events-none select-none' : ''}`}>
            {assessment.coreCompetencies.map((comp, idx) => (
              <div key={comp.id} className="p-8 md:p-10 bg-white rounded-[2.5rem] border border-slate-200 break-inside-avoid">
                <div className="flex justify-between items-start mb-6">
                   <h5 className="text-xl font-black text-slate-900">{idx + 1}. {comp.name}</h5>
                   <div className="text-right">
                    <span className="text-[9px] font-black text-brand-600 block">Self: {comp.selfRating ? comp.selfRating.split(' - ')[0] : 'N/A'}</span>
                   </div>
                </div>

                {/* Mid-Year Review Section for Competencies */}
                {(comp.midYearSelfComments || comp.midYearManagerComments || isFinalReviewLocked) && (
                  <div className="mb-8 p-6 bg-blue-50/30 rounded-3xl border border-blue-100 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-blue-50 text-xs text-slate-600 italic">
                        <span className="text-[8px] font-bold text-blue-400 uppercase block mb-1">Mid-Year Reflection</span>
                        {comp.midYearSelfComments ? `"${comp.midYearSelfComments}"` : <span className="text-slate-400 italic">No reflection provided.</span>}
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-blue-50 text-xs text-slate-700">
                        <span className="text-[8px] font-bold text-blue-400 uppercase block mb-1">Mid-Year Feedback</span>
                        {!isEditable ? (
                          <p className="italic text-slate-500">{comp.midYearManagerComments || 'No feedback provided.'}</p>
                        ) : (
                          <DebouncedTextarea 
                            value={comp.midYearManagerComments || ''} 
                            onChange={(val) => handleUpdate({...assessmentRef.current, coreCompetencies: assessmentRef.current.coreCompetencies.map(c => c.id === comp.id ? {...c, midYearManagerComments: val} : c)})}
                            className="w-full text-[10px] border-none p-0 bg-transparent outline-none h-12 resize-none focus:ring-0"
                            placeholder="Mid-year feedback..."
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t bg-slate-50/50 p-6 rounded-3xl grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div>
                    {!isEditable ? (
                      <div className="p-3 bg-white border rounded-xl text-sm font-bold">{comp.managerRating ? comp.managerRating.split(' - ')[0] : 'N/A'}</div>
                    ) : (
                      renderRatingSelect(comp.managerRating, (r) => handleUpdate({...assessmentRef.current, coreCompetencies: assessmentRef.current.coreCompetencies.map(c => c.id === comp.id ? {...c, managerRating: r} : c)}))
                    )}
                   </div>
                   <div className="md:col-span-2">
                    {!isEditable ? (
                      <div className="p-4 bg-white border rounded-2xl text-xs">{comp.managerComments || ''}</div>
                    ) : (
                      <DebouncedTextarea 
                      value={comp.managerComments || ''} 
                      onChange={(val) => handleUpdate({...assessmentRef.current, coreCompetencies: assessmentRef.current.coreCompetencies.map(c => c.id === comp.id ? {...c, managerComments: val} : c)})} 
                      className="w-full text-xs border rounded-2xl p-4 h-24 outline-none focus:ring-2 focus:ring-brand-500" 
                      placeholder="Comment..." 
                    />
                    )}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Individual Development Section */}
        <section className="break-inside-avoid">
          <SectionTitle colorClass="border-blue-500">Individual Development</SectionTitle>
          
          <div className="mb-8 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-200">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Individual Development Goal</span>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-sm text-slate-700 leading-relaxed italic shadow-inner">
              {assessment.developmentPlan.developmentGoal}
            </div>
          </div>

          <div className="space-y-8">
            {(assessment.developmentPlan.midYearSelfComments || assessment.developmentPlan.midYearManagerComments || isFinalReviewLocked) && (
              <div className="p-8 md:p-10 bg-blue-50/30 rounded-[2.5rem] border border-blue-100 space-y-6">
                 <div className="space-y-4">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Mid-Year Reflection</span>
                    <div className="bg-white p-8 rounded-[2rem] border border-blue-50 text-sm text-slate-700 italic leading-normal min-h-[80px]">
                      {assessment.developmentPlan.midYearSelfComments ? `"${assessment.developmentPlan.midYearSelfComments}"` : <span className="text-slate-400 italic">No reflection provided.</span>}
                    </div>
                 </div>
                 <div className="space-y-4">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Manager Mid-Year Feedback</span>
                    <div className="bg-white p-8 rounded-[2rem] border border-blue-50 text-sm text-slate-700 leading-normal min-h-[80px]">
                      {!isEditable ? (
                        <p className="italic text-slate-500">{assessment.developmentPlan.midYearManagerComments || 'No feedback provided.'}</p>
                      ) : (
                        <DebouncedTextarea 
                          value={assessment.developmentPlan.midYearManagerComments || ''} 
                          onChange={(val) => handleUpdate({...assessmentRef.current, developmentPlan: {...assessmentRef.current.developmentPlan, midYearManagerComments: val}})}
                          className="w-full text-xs border-none p-0 bg-transparent outline-none h-24 resize-none focus:ring-0"
                          placeholder="Enter mid-year feedback for development plan..."
                        />
                      )}
                    </div>
                 </div>
              </div>
            )}
            <div className={`space-y-10 ${isFinalReviewLocked ? 'opacity-50 grayscale pointer-events-none select-none' : ''}`}>
              <h6 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.4em] mb-6">Final Review</h6>
              <div className="p-8 md:p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                 <div className="space-y-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Staff Reflection</span>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 text-sm text-slate-700 italic leading-normal min-h-[120px]">
                      {assessment.developmentPlan.selfComments ? `"${assessment.developmentPlan.selfComments}"` : ""}
                    </div>
                 </div>
              </div>
              
              <div className="pt-10 mt-10 border-t-2 border-slate-200 bg-white p-8 rounded-[2rem] border-2 shadow-sm break-inside-avoid">
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest block">Manager Final Feedback</span>
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-sm text-slate-700 leading-normal min-h-[120px]">
                    {!isEditable ? (
                      <p className="italic text-slate-500">{assessment.developmentPlan.managerComments || 'No feedback provided.'}</p>
                    ) : (
                      <DebouncedTextarea 
                        value={assessment.developmentPlan.managerComments || ''} 
                        onChange={(val) => handleUpdate({...assessmentRef.current, developmentPlan: {...assessmentRef.current.developmentPlan, managerComments: val}})}
                        className="w-full text-xs border-none p-0 bg-transparent outline-none h-32 resize-none focus:ring-0"
                        placeholder="Enter final manager feedback for development plan..."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Executive Summary Section */}
        <section className="break-inside-avoid">
          <SectionTitle>Executive Summary & Final Grade</SectionTitle>
          <div className="space-y-12">
            {(assessment.overallPerformance.midYearSelfComments || assessment.overallPerformance.midYearManagerComments || isFinalReviewLocked) && (
              <div className="p-8 md:p-10 bg-blue-50/30 rounded-[2.5rem] border border-blue-100 space-y-6">
                 <div className="space-y-4">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Mid-Year Summary</span>
                    <div className="bg-white p-8 rounded-[2rem] border border-blue-50 text-sm text-slate-700 italic leading-normal">
                      {assessment.overallPerformance.midYearSelfComments ? `"${assessment.overallPerformance.midYearSelfComments}"` : <span className="text-slate-400 italic">No summary provided.</span>}
                    </div>
                 </div>
                 <div className="space-y-4">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Manager Mid-Year Feedback</span>
                    <div className="bg-white p-8 rounded-[2rem] border border-blue-50 text-sm text-slate-700 leading-normal">
                      {!isEditable ? (
                        <p className="italic text-slate-500">{assessment.overallPerformance.midYearManagerComments || 'No feedback provided.'}</p>
                      ) : (
                        <DebouncedTextarea 
                          value={assessment.overallPerformance.midYearManagerComments || ''} 
                          onChange={(val) => handleUpdate({...assessmentRef.current, overallPerformance: {...assessmentRef.current.overallPerformance, midYearManagerComments: val}})}
                          className="w-full text-xs border-none p-0 bg-transparent outline-none h-24 resize-none focus:ring-0"
                          placeholder="Enter mid-year executive summary feedback..."
                        />
                      )}
                    </div>
                 </div>
              </div>
            )}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${isFinalReviewLocked ? 'opacity-50 grayscale pointer-events-none select-none' : ''}`}>
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Staff Summary</span>
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border text-sm italic">
                   {assessment.overallPerformance.selfComments ? `"${assessment.overallPerformance.selfComments}"` : ""}
                </div>
              </div>
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Staff Performance Rating</span>
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border text-sm font-bold text-slate-600 flex items-center justify-center">
                  {assessment.overallPerformance.selfRating ? assessment.overallPerformance.selfRating.split(' - ')[0] : 'N/A'}
                </div>
              </div>
            </div>

            {!isEditable && (
              <div className="space-y-4">
                <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest block">Final Evaluation</span>
                <div className="p-8 bg-brand-50 rounded-[2.5rem] border border-brand-100 text-sm font-medium text-slate-800 leading-normal">
                  {assessment.overallPerformance.managerComments || ''}
                </div>
              </div>
            )}

            {isEditable ? (
              <div className="bg-brand-50 p-10 rounded-[3rem] border-2 border-brand-100 flex flex-col gap-10">
                <div className={`space-y-10 ${isFinalReviewLocked ? 'opacity-50 grayscale pointer-events-none select-none' : ''}`}>
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Manager Final Summary</span>
                    <DebouncedTextarea 
                      value={assessment.overallPerformance.managerComments || ''} 
                      onChange={(val) => handleUpdate({...assessmentRef.current, overallPerformance: {...assessmentRef.current.overallPerformance, managerComments: val}})} 
                      className="w-full bg-white text-slate-800 p-8 rounded-[2rem] border-slate-200 outline-none text-sm h-56 focus:ring-2 focus:ring-brand-500 shadow-lg leading-normal" 
                      placeholder="Enter final executive evaluation..." 
                    />
                  </div>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-6 border-t border-brand-200">
                    <div className="flex-1 w-full">
                      <select value={assessment.overallPerformance.managerRating || ''} onChange={(e) => handleUpdate({...assessmentRef.current, overallPerformance: {...assessmentRef.current.overallPerformance, managerRating: e.target.value as Rating}})} className="w-full bg-white p-4 rounded-xl border font-bold">
                        <option value="">Select Official Result...</option>
                        {Object.values(Rating).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t border-brand-100">
                  {isFinalReviewLocked ? (
                    <button 
                      onClick={() => {
                        if (!validateMidYearFeedback()) return;
                        if(confirm("Submit mid-year feedback? This will unlock the final review sections for later in the year.")) {
                          handleUpdate({...assessmentRef.current, midYearStatus: 'reviewed'}, true);
                          alert("Mid-year feedback submitted. Final review sections are now unlocked.");
                        }
                      }} 
                      className="bg-blue-600 text-white px-14 py-6 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-blue-700"
                    >
                      Submit Mid-Year Feedback
                    </button>
                  ) : (
                    <button onClick={() => {
                      if (!validateFinalReview()) return;
                      if(confirm("Submit and finalize this review?")) onFinalize?.({...assessmentRef.current, status: 'reviewed'});
                    }} className="bg-brand-600 text-white px-14 py-6 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-brand-700">Complete Review</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 md:p-8 bg-[#0f172a] text-white rounded-[2rem] flex flex-row items-center justify-between gap-8 shadow-2xl print:bg-[#0f172a] print:text-white relative break-inside-avoid overflow-hidden">
                 <div className="flex items-center gap-8 flex-shrink-0">
                    <span className="text-[10px] font-black text-[#d58f5c] uppercase tracking-widest leading-none">Final Result</span>
                    <span className="text-sm font-black leading-none whitespace-nowrap">
                      {assessment.overallPerformance.managerRating ? assessment.overallPerformance.managerRating.split(' - ')[0] : 'PENDING'}
                    </span>
                 </div>
                 
                 <div className="flex-1 flex items-center justify-end gap-8">
                    <div className="hidden md:block w-px h-8 bg-slate-700 opacity-50"></div>
                    <div className="text-right flex flex-col justify-center gap-1">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 whitespace-nowrap">Reviewed & Archived</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AppraisalReport;
