
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
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 text-sm text-slate-700 leading-relaxed italic shadow-inner">
                    {kpi.description}
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                       <span className="text-[9px] font-black uppercase tracking-widest text-brand-600">Staff Rating</span>
                       <div className="p-3 bg-white border rounded-xl text-sm font-bold text-slate-700">{kpi.selfRating || 'Pending'}</div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <span className="text-[9px] font-black uppercase tracking-widest text-brand-600">Staff Comments</span>
                       <div className="p-4 bg-white border rounded-xl text-xs text-slate-600 italic">"{kpi.selfComments || 'No comments.'}"</div>
                    </div>
                  </div>
                  <div className="pt-10 mt-10 border-t-2 border-slate-200 bg-white p-8 rounded-[2rem] border-2 shadow-sm break-inside-avoid">
                    <h6 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.4em] mb-6">Assessor Feedback</h6>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-4">
                        {!isEditable ? (
                           <div className="p-3 bg-slate-50 border rounded-xl text-sm font-bold text-slate-800">{kpi.managerRating || 'Pending'}</div>
                        ) : (
                           renderRatingSelect(kpi.managerRating, (r) => onUpdate?.({...assessment, kpis: assessment.kpis.map(k => k.id === kpi.id ? {...k, managerRating: r} : k)}))
                        )}
                      </div>
                      <div className="md:col-span-2 space-y-4">
                        {!isEditable ? (
                           <div className="p-5 bg-slate-50 border rounded-2xl text-xs text-slate-700 italic">{kpi.managerComments || 'No feedback.'}</div>
                        ) : (
                           <textarea value={kpi.managerComments || ''} onChange={(e) => onUpdate?.({...assessment, kpis: assessment.kpis.map(k => k.id === kpi.id ? {...k, managerComments: e.target.value} : k)})} className="w-full text-xs border rounded-2xl p-5 h-36 outline-none bg-slate-50/50 focus:ring-2 focus:ring-brand-500" placeholder="Evaluate performance..." />
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
          <div className="space-y-12">
            {assessment.coreCompetencies.map((comp, idx) => (
              <div key={comp.id} className="p-8 md:p-10 bg-white rounded-[2.5rem] border border-slate-200 break-inside-avoid">
                <div className="flex justify-between items-start mb-6">
                   <h5 className="text-xl font-black text-slate-900">{idx + 1}. {comp.name}</h5>
                   <div className="text-right">
                    <span className="text-[9px] font-black text-brand-600 block">Self: {comp.selfRating || 'N/A'}</span>
                   </div>
                </div>
                <div className="pt-6 border-t bg-slate-50/50 p-6 rounded-3xl grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div>
                    {!isEditable ? (
                      <div className="p-3 bg-white border rounded-xl text-sm font-bold">{comp.managerRating || 'Pending'}</div>
                    ) : (
                      renderRatingSelect(comp.managerRating, (r) => onUpdate?.({...assessment, coreCompetencies: assessment.coreCompetencies.map(c => c.id === comp.id ? {...c, managerRating: r} : c)}))
                    )}
                   </div>
                   <div className="md:col-span-2">
                    {!isEditable ? (
                      <div className="p-4 bg-white border rounded-2xl text-xs">{comp.managerComments || 'No feedback.'}</div>
                    ) : (
                      <textarea value={comp.managerComments || ''} onChange={(e) => onUpdate?.({...assessment, coreCompetencies: assessment.coreCompetencies.map(c => c.id === comp.id ? {...c, managerComments: e.target.value} : c)})} className="w-full text-xs border rounded-2xl p-4 h-24 outline-none focus:ring-2 focus:ring-brand-500" placeholder="Comment..." />
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
          <div className="space-y-8">
            <div className="p-8 md:p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Staff Reflection</span>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 text-sm text-slate-700 italic leading-relaxed min-h-[160px]">
                      "{assessment.developmentPlan.selfComments || 'No reflection provided.'}"
                    </div>
                  </div>
                  <div className="space-y-4">
                    <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest block">Assessor Development Roadmap</span>
                    {!isEditable ? (
                      <div className="bg-brand-50 p-8 rounded-[2rem] border border-brand-100 text-sm font-medium text-slate-800 min-h-[160px]">
                        {assessment.developmentPlan.managerComments || 'No development plan provided.'}
                      </div>
                    ) : (
                      <textarea 
                        value={assessment.developmentPlan.managerComments || ''} 
                        onChange={(e) => onUpdate?.({...assessment, developmentPlan: {...assessment.developmentPlan, managerComments: e.target.value}})} 
                        className="w-full bg-white text-slate-800 p-8 rounded-[2rem] border-slate-200 outline-none text-sm h-[160px] focus:ring-2 focus:ring-brand-500 shadow-sm" 
                        placeholder="Define growth areas and training objectives..." 
                      />
                    )}
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* Executive Summary Section */}
        <section className="break-inside-avoid">
          <SectionTitle>Executive Summary & Final Grade</SectionTitle>
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Staff Summary Narrative</span>
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border text-sm italic">
                  "{assessment.overallPerformance.selfComments || 'No summary provided.'}"
                </div>
              </div>
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Staff Suggested Grade</span>
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border text-sm font-bold text-slate-600 flex items-center justify-center">
                  {assessment.overallPerformance.selfRating || 'No suggestion provided'}
                </div>
              </div>
            </div>

            {!isEditable && (
              <div className="space-y-4">
                <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest block">Assessor Full Evaluation</span>
                <div className="p-8 bg-brand-50 rounded-[2.5rem] border border-brand-100 text-sm font-medium text-slate-800">
                  {assessment.overallPerformance.managerComments || 'No manager narrative provided.'}
                </div>
              </div>
            )}

            {isEditable ? (
              <div className="bg-brand-50 p-10 rounded-[3rem] border-2 border-brand-100 flex flex-col gap-10">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Assessor Final Narrative</span>
                  <textarea 
                    value={assessment.overallPerformance.managerComments || ''} 
                    onChange={(e) => onUpdate?.({...assessment, overallPerformance: {...assessment.overallPerformance, managerComments: e.target.value}})} 
                    className="w-full bg-white text-slate-800 p-8 rounded-[2rem] border-slate-200 outline-none text-sm h-56 focus:ring-2 focus:ring-brand-500 shadow-lg" 
                    placeholder="Enter final executive evaluation..." 
                  />
                </div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-6 border-t border-brand-200">
                  <div className="flex-1 w-full">
                    <select value={assessment.overallPerformance.managerRating || ''} onChange={(e) => onUpdate?.({...assessment, overallPerformance: {...assessment.overallPerformance, managerRating: e.target.value as Rating}})} className="w-full bg-white p-4 rounded-xl border font-bold">
                      <option value="">Select Official Result...</option>
                      {Object.values(Rating).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button onClick={() => {
                    if(!assessment.overallPerformance.managerRating) return alert("Final grade required.");
                    if(confirm("Submit and finalize this review?")) onFinalize?.({...assessment, status: 'reviewed'});
                  }} className="bg-brand-600 text-white px-14 py-6 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-brand-700">Complete Review</button>
                </div>
              </div>
            ) : (
              <div className="p-6 md:p-8 bg-[#0f172a] text-white rounded-[2rem] flex flex-row items-center justify-between gap-8 shadow-2xl print:bg-[#0f172a] print:text-white relative break-inside-avoid overflow-hidden">
                 <div className="flex items-center gap-8 flex-shrink-0">
                    <span className="text-[10px] font-black text-[#d58f5c] uppercase tracking-widest leading-none">Final Result</span>
                    <span className="text-sm font-black leading-none whitespace-nowrap">
                      {assessment.overallPerformance.managerRating || 'PENDING'}
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
