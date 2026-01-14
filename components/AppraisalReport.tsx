import React, { useState } from 'react';
import { Assessment, Rating } from '../types.ts';
import { analyzeAssessment } from '../services/geminiService.ts';

interface AppraisalReportProps {
  assessment: Assessment;
  isEditable: boolean;
  onUpdate?: (updated: Assessment) => void;
  onFinalize?: (final: Assessment) => void;
  isDownloading?: boolean;
}

// Fixed: Moved SectionTitle outside the main component to resolve TypeScript children prop errors
// This ensures that the JSX transformer correctly identifies children passed via tag content.
// Added optional modifier to children to resolve 'property missing' errors in some TS configurations.
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
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const insight = await analyzeAssessment(assessment);
      setAiInsight(insight);
    } catch (err) {
      alert("AI analysis failed. Please check your Gemini API key.");
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
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${assessment.status === 'reviewed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'} no-print`}>
          {assessment.status}
        </span>
      </div>

      <div className="space-y-24">
        {/* KPI Section */}
        <section>
          <div className="flex justify-between items-center mb-8">
            <SectionTitle>Key Performance Indicators</SectionTitle>
            {isEditable && !aiInsight && (
              <button 
                onClick={handleAiAnalysis} 
                disabled={isAnalyzing}
                className="text-[10px] font-black uppercase tracking-widest text-brand-600 border border-brand-200 px-4 py-2 rounded-full hover:bg-brand-50 transition-all flex items-center gap-2"
              >
                {isAnalyzing ? 'Analyzing...' : '✨ AI Performance Insight'}
              </button>
            )}
          </div>

          {aiInsight && isEditable && (
            <div className="mb-12 p-8 bg-brand-900 text-white rounded-[2rem] shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-300">Gemini Intelligence Summary</span>
                <button onClick={() => setAiInsight(null)} className="text-xs opacity-50 hover:opacity-100">&times; Close</button>
              </div>
              <p className="text-sm leading-relaxed italic">{aiInsight}</p>
            </div>
          )}

          <div className="space-y-16">
            {assessment.kpis.map((kpi) => (
              <div key={kpi.id} className="p-8 md:p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100 print:bg-white print:border-slate-200">
                <h5 className="text-2xl font-black text-slate-900 mb-6">{kpi.title}</h5>
                <div className="mb-10">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 opacity-60">KPI Description</span>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 text-sm text-slate-700 leading-relaxed italic shadow-inner">
                    {kpi.description}
                  </div>
                </div>

                <div className="space-y-10">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-2">Staff Self-Appraisal</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                       <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-black uppercase rounded tracking-widest">Staff Rating</span>
                       <div className="p-3 bg-white border border-brand-100 rounded-xl text-sm font-bold text-slate-700 shadow-sm">{kpi.selfRating || 'Pending'}</div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-black uppercase rounded tracking-widest">Achievement Comments</span>
                       <div className="p-4 bg-white border border-brand-100 rounded-xl text-xs text-slate-600 italic leading-relaxed min-h-[100px] shadow-sm">
                          "{kpi.selfComments || 'No comments provided.'}"
                       </div>
                    </div>
                  </div>

                  <div className="pt-10 mt-10 border-t-2 border-slate-200 space-y-8 bg-white p-8 rounded-[2rem] border-2 shadow-lg border-slate-200 print:shadow-none">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-3 h-3 rounded-full bg-slate-900"></div>
                      <h6 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.4em]">Official Assessor Feedback Loop</h6>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-4">
                        <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded tracking-widest">Assessor Rating</span>
                        {!isEditable ? (
                           <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800">{kpi.managerRating || 'Pending'}</div>
                        ) : (
                           renderRatingSelect(kpi.managerRating, (r) => {
                             if(onUpdate) {
                               onUpdate({...assessment, kpis: assessment.kpis.map(k => k.id === kpi.id ? {...k, managerRating: r} : k)});
                             }
                           })
                        )}
                      </div>
                      <div className="md:col-span-2 space-y-4">
                        <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded tracking-widest">Assessor Review Comments</span>
                        {!isEditable ? (
                           <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 min-h-[144px] leading-relaxed italic">{kpi.managerComments || 'Awaiting final evaluation.'}</div>
                        ) : (
                           <textarea 
                             value={kpi.managerComments || ''}
                             onChange={(e) => {
                               if(onUpdate) {
                                 onUpdate({...assessment, kpis: assessment.kpis.map(k => k.id === kpi.id ? {...k, managerComments: e.target.value} : k)});
                               }
                             }}
                             className="w-full text-xs border border-slate-300 rounded-2xl p-5 h-36 outline-none focus:ring-2 focus:ring-brand-500 shadow-inner bg-slate-50/50"
                             placeholder="Evaluate staff performance against this goal..."
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

        {/* Competencies */}
        <section>
          <SectionTitle colorClass="border-slate-400">Core Competencies</SectionTitle>
          <div className="space-y-12">
            {assessment.coreCompetencies.map((comp, idx) => (
              <div key={comp.id} className="p-8 md:p-10 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                <div className="flex justify-between items-start">
                   <h5 className="text-xl font-black text-slate-900">{idx + 1}. {comp.name}</h5>
                   <div className="text-right">
                    <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-black uppercase rounded tracking-widest block mb-1">Staff Self-Rating</span>
                    <span className="text-sm font-bold text-slate-800">{comp.selfRating || 'N/A'}</span>
                   </div>
                </div>
                <div className="pt-10 border-t border-slate-200 bg-slate-50/50 p-8 rounded-3xl space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                      <div className="space-y-2">
                         <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded tracking-widest block mb-3">Official Competency Grade</span>
                         {!isEditable ? (
                            <div className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800">{comp.managerRating || 'Pending'}</div>
                         ) : (
                            renderRatingSelect(comp.managerRating, (r) => {
                              if(onUpdate) {
                                onUpdate({...assessment, coreCompetencies: assessment.coreCompetencies.map(c => c.id === comp.id ? {...c, managerRating: r} : c)});
                              }
                            })
                         )}
                      </div>
                      <div className="md:col-span-2 space-y-2">
                         <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded tracking-widest block mb-3">Evidence-Based Assessment</span>
                         {!isEditable ? (
                            <div className="p-4 bg-white border border-slate-200 rounded-2xl text-xs text-slate-700 min-h-[112px] leading-relaxed">{comp.managerComments || 'Awaiting feedback.'}</div>
                         ) : (
                            <textarea 
                              value={comp.managerComments || ''}
                              onChange={(e) => {
                                if(onUpdate) {
                                  onUpdate({...assessment, coreCompetencies: assessment.coreCompetencies.map(c => c.id === comp.id ? {...c, managerComments: e.target.value} : c)});
                                }
                              }}
                              className="w-full text-xs border border-slate-300 rounded-2xl p-4 h-28 outline-none focus:ring-2 focus:ring-brand-500 shadow-inner bg-white"
                              placeholder="Comment on behavioral indicators..."
                            />
                         )}
                      </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Development Plan */}
        <section className="bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl text-white print:bg-slate-100 print:text-slate-900 print:shadow-none">
           <SectionTitle colorClass="border-brand-500">Individual Development Plan</SectionTitle>
           <div className="space-y-10">
              <div className="space-y-3">
                <span className="px-2 py-0.5 bg-brand-600 text-white text-[9px] font-black uppercase rounded tracking-widest">Staff Development Goals</span>
                <div className="p-6 bg-slate-800 rounded-2xl text-xs text-slate-300 italic leading-relaxed min-h-[120px] print:bg-white print:text-slate-600 print:border">
                  "{assessment.developmentPlan.selfComments || 'No self-reflection provided.'}"
                </div>
              </div>
              <div className="space-y-3">
                <span className="px-2 py-0.5 bg-white text-slate-900 text-[9px] font-black uppercase rounded tracking-widest border border-slate-200 print:bg-slate-900 print:text-white">Assessor Developmental Roadmap</span>
                {!isEditable ? (
                   <div className="p-6 bg-slate-800 rounded-2xl text-sm text-white print:bg-white print:text-slate-800 print:border min-h-[160px]">{assessment.developmentPlan.managerComments || 'Awaiting developmental focus.'}</div>
                ) : (
                   <textarea 
                     value={assessment.developmentPlan.managerComments || ''}
                     onChange={(e) => {
                       if(onUpdate) onUpdate({...assessment, developmentPlan: {...assessment.developmentPlan, managerComments: e.target.value}});
                     }}
                     className="w-full text-xs bg-slate-800 text-white border-none rounded-2xl p-6 h-40 outline-none focus:ring-2 focus:ring-brand-500 shadow-inner"
                     placeholder="Outline specific training needs..."
                   />
                )}
              </div>
           </div>
        </section>

        {/* Final Grade */}
        <section className="pt-12 border-t-2 border-slate-100">
          <SectionTitle>Executive Summary & Final Grade</SectionTitle>
          <div className="space-y-12">
            <div className="space-y-3">
              <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-black uppercase rounded tracking-widest">Staff Final Summary</span>
              <div className="p-8 bg-slate-50 rounded-[2.5rem] border text-sm text-slate-600 italic leading-relaxed shadow-inner">
                "{assessment.overallPerformance.selfComments || 'No overall summary provided.'}"
              </div>
            </div>

            {isEditable ? (
              <div className="bg-brand-50 p-10 rounded-[3rem] border-2 border-brand-100 flex flex-col gap-10">
                <div className="space-y-4">
                  <label className="text-brand-900 text-[10px] font-black uppercase tracking-[0.3em] px-2 block">Manager Final Appraisal Narrative</label>
                  <textarea 
                    value={assessment.overallPerformance.managerComments || ''}
                    onChange={(e) => {
                      if(onUpdate) onUpdate({...assessment, overallPerformance: {...assessment.overallPerformance, managerComments: e.target.value}});
                    }}
                    className="w-full bg-white text-slate-800 p-8 rounded-[2rem] border-slate-200 outline-none text-sm h-56 focus:ring-2 focus:ring-brand-500 shadow-lg"
                    placeholder="Provide the final executive evaluation..."
                  />
                </div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-6 border-t border-brand-200">
                  <div className="flex-1 w-full max-w-md">
                    <label className="text-brand-900 text-[10px] font-black uppercase tracking-widest block mb-3">Final Official Performance Grade</label>
                    <select 
                      value={assessment.overallPerformance.managerRating || ''}
                      onChange={(e) => {
                        if(onUpdate) onUpdate({...assessment, overallPerformance: {...assessment.overallPerformance, managerRating: e.target.value as Rating}});
                      }}
                      className="w-full bg-white text-slate-900 p-4 rounded-xl border border-brand-300 outline-none text-sm font-bold shadow-sm"
                    >
                      <option value="">Select Official Result...</option>
                      {Object.values(Rating).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button 
                    onClick={() => {
                      if(!assessment.overallPerformance.managerRating) return alert("Final grade is required.");
                      if(onFinalize) onFinalize({...assessment, status: 'reviewed'});
                    }} 
                    className="bg-brand-600 text-white px-14 py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] hover:bg-brand-700 transition-all shadow-2xl transform active:scale-95"
                  >
                    Finalize Review Cycle
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 bg-slate-900 text-white rounded-[3rem] flex flex-col md:flex-row justify-between items-center gap-10 shadow-2xl print:bg-slate-50 print:text-slate-900 print:border">
                 <div className="space-y-2">
                    <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest block">Final Result</span>
                    <span className="text-5xl font-black text-white print:text-brand-900">{assessment.overallPerformance.managerRating || 'PENDING'}</span>
                 </div>
                 <div className="md:max-w-lg text-right border-l border-slate-700 pl-10 print:border-slate-300">
                    <p className="text-sm text-slate-400 italic font-medium leading-relaxed print:text-slate-600">
                      {assessment.overallPerformance.managerComments || 'Assessment cycle is in progress.'}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-40">Review Concluded & Archived</p>
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