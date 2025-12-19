
import React, { useState } from 'react';
import { Assessment, Rating, KPI } from '../types.ts';
import { RATING_DESCRIPTIONS } from '../constants.ts';

interface AdminDashboardProps {
  assessments: Assessment[];
  onReviewComplete: (updated: Assessment) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ assessments, onReviewComplete }) => {
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleReviewClick = (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    setSendSuccess(false);
  };

  const updateSelectedKPI = (kpiId: string, updates: Partial<KPI>) => {
    if (!selectedAssessment) return;
    const updated = {
      ...selectedAssessment,
      kpis: selectedAssessment.kpis.map(k => k.id === kpiId ? { ...k, ...updates } : k)
    };
    setSelectedAssessment(updated);
  };

  const handleManagerRatingChange = (field: 'managerRating' | 'overallRating', value: Rating, kpiId?: string) => {
    if (!selectedAssessment) return;

    if (kpiId) {
      updateSelectedKPI(kpiId, { managerRating: value });
    } else {
      const updated = {
        ...selectedAssessment,
        overallPerformance: { ...selectedAssessment.overallPerformance, managerRating: value }
      };
      setSelectedAssessment(updated);
    }
  };

  const handleFinalSubmit = () => {
    if (!selectedAssessment) return;
    onReviewComplete({ ...selectedAssessment, status: 'reviewed' });
    setSelectedAssessment({ ...selectedAssessment, status: 'reviewed' });
  };

  const handleSendToStaff = () => {
    setIsSending(true);
    // Simulate API call to send email/PDF
    setTimeout(() => {
      setIsSending(false);
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 5000);
    }, 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (selectedAssessment) {
    const isReviewed = selectedAssessment.status === 'reviewed';

    return (
      <div className="space-y-6 print:m-0 print:p-0">
        <div className="flex justify-between items-center print:hidden">
          <button 
            onClick={() => setSelectedAssessment(null)}
            className="text-sm font-bold text-brand-600 flex items-center gap-1 hover:underline"
          >
            &larr; Back to Submissions
          </button>
          <div className="flex items-center gap-4">
            {isReviewed && (
              <>
                <button 
                  onClick={handlePrint}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Download PDF
                </button>
                <button 
                  onClick={handleSendToStaff}
                  disabled={isSending}
                  className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all ${
                    sendSuccess ? 'bg-green-600 text-white' : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {isSending ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sending...</>
                  ) : sendSuccess ? (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Results Sent</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> Send to Staff</>
                  )}
                </button>
              </>
            )}
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {isReviewed ? 'Archived Report' : 'In-Progress Review'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
          {/* Main Review Panel */}
          <div className="lg:col-span-2 space-y-6 print:space-y-12">
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none">
              <div className="flex justify-between items-center mb-6 border-b pb-6">
                <div>
                   <h3 className="text-2xl font-bold text-slate-800">{selectedAssessment.employeeDetails.fullName}</h3>
                   <span className="text-sm font-medium text-slate-500">{selectedAssessment.employeeDetails.position} • {selectedAssessment.employeeDetails.division}</span>
                </div>
                <div className="text-right hidden print:block">
                   <div className="text-[12px] font-bold text-slate-900 tracking-[0.2em] mb-1">METABEV</div>
                   <div className="text-[8px] text-slate-400 uppercase tracking-widest">Performance Review 2024</div>
                </div>
              </div>

              {/* KPI Review */}
              <div className="space-y-8">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b pb-2">KPI Assessment Summary</h4>
                {selectedAssessment.kpis.map((kpi, idx) => (
                  <div key={kpi.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100 print:bg-white print:border-slate-200 mb-6">
                    <div className="flex justify-between items-start mb-3">
                      <h5 className="font-bold text-slate-700">{idx + 1}. {kpi.title}</h5>
                      {isReviewed && <span className="text-xs font-black bg-brand-600 text-white px-2 py-1 rounded">Final: {kpi.managerRating}</span>}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Staff Submission</label>
                        <p className="text-xs text-slate-700 bg-white p-3 rounded border border-slate-200 min-h-[60px] italic">
                          "{kpi.selfComments || 'No self-assessment provided.'}"
                        </p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Assessor Feedback</label>
                        {isReviewed ? (
                          <p className="text-xs text-slate-800 bg-brand-50 p-3 rounded border border-brand-200 min-h-[60px]">
                            {kpi.managerComments || 'No manager feedback provided.'}
                          </p>
                        ) : (
                          <textarea 
                            value={kpi.managerComments || ''}
                            onChange={(e) => updateSelectedKPI(kpi.id, { managerComments: e.target.value })}
                            className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-brand-500 outline-none h-16 resize-none"
                            placeholder="Provide final feedback..."
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Core Competencies Comparison */}
              <div className="mt-12 space-y-6 print:page-break-before">
                <h4 className="text-[16px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-4 mb-4">
                  Core Competencies Comparison
                </h4>
                <div className="divide-y divide-slate-100">
                  {selectedAssessment.coreCompetencies.map(comp => (
                    <div key={comp.id} className="flex items-center justify-between py-5 gap-6">
                      <div className="flex-1">
                        <span className="text-sm font-bold text-slate-700 block">{comp.name}</span>
                        <span className="text-[10px] text-slate-400 italic block mt-1 leading-tight">{comp.description}</span>
                      </div>
                      <div className="flex items-center gap-10">
                         <div className="whitespace-nowrap">
                            <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase text-right">Self</span>
                            <span className="text-sm font-bold text-brand-700">{comp.selfRating || 'N/A'}</span>
                         </div>
                         <div className="w-40 relative">
                           <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase print:block hidden">Assessor</span>
                            {isReviewed ? (
                               <div className="text-sm font-black text-brand-900 border-l-2 border-brand-600 pl-4 py-1">
                                 {comp.managerRating || 'Not Rated'}
                               </div>
                            ) : (
                              <select 
                                value={comp.managerRating || ''}
                                onChange={(e) => {
                                  const updated = {
                                    ...selectedAssessment,
                                    coreCompetencies: selectedAssessment.coreCompetencies.map(c => c.id === comp.id ? { ...c, managerRating: e.target.value as Rating } : c)
                                  };
                                  setSelectedAssessment(updated);
                                }}
                                className="w-full h-11 pl-4 pr-10 text-sm font-medium border border-slate-200 rounded-lg bg-white hover:border-brand-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all appearance-none cursor-pointer text-slate-700 shadow-sm"
                              >
                                 <option value="">Rate</option>
                                 {Object.values(Rating).map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            )}
                            {!isReviewed && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                 </svg>
                              </div>
                            )}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual Development Review */}
              <div className="mt-16 space-y-4 print:page-break-before">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b pb-2">Individual Development Summary</h4>
                <div className="p-6 bg-white rounded-lg border border-slate-200">
                  <div className="mb-6">
                    <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Staff Reflection</label>
                    <p className="text-sm text-slate-700 italic bg-slate-50 p-4 rounded min-h-[60px]">
                      "{selectedAssessment.developmentPlan.selfComments || 'No development comments provided.'}"
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Manager Growth Recommendations</label>
                    {isReviewed ? (
                      <p className="text-sm text-slate-800 bg-brand-50 p-4 rounded border border-brand-200 leading-relaxed">
                        {selectedAssessment.developmentPlan.managerComments || 'No growth recommendations provided.'}
                      </p>
                    ) : (
                      <textarea 
                        value={selectedAssessment.developmentPlan.managerComments || ''}
                        onChange={(e) => setSelectedAssessment({
                          ...selectedAssessment,
                          developmentPlan: { ...selectedAssessment.developmentPlan, managerComments: e.target.value }
                        })}
                        className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-1 focus:ring-brand-500 outline-none h-32 resize-none"
                        placeholder="Provide feedback on development and growth..."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b pb-2 mb-6">Final Recommendation</h4>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 print:text-xs">Overall Performance Narrative</label>
                    {isReviewed ? (
                       <p className="text-sm text-slate-800 bg-brand-50 p-5 rounded-xl border border-brand-200 leading-relaxed italic">
                         "{selectedAssessment.overallPerformance.managerComments}"
                       </p>
                    ) : (
                      <textarea 
                        value={selectedAssessment.overallPerformance.managerComments}
                        onChange={(e) => setSelectedAssessment({ ...selectedAssessment, overallPerformance: { ...selectedAssessment.overallPerformance, managerComments: e.target.value } })}
                        className="w-full border border-slate-300 rounded-lg p-4 text-sm focus:ring-2 focus:ring-brand-500 outline-none h-32"
                        placeholder="Enter the final performance summary and manager's perspective..."
                      />
                    )}
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between pt-4 border-t border-slate-50">
                    <div className="max-w-md w-full">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Final Agreed Rating</label>
                      {isReviewed ? (
                         <div className="text-2xl font-black text-brand-700 px-4 py-2 bg-brand-50 inline-block rounded-lg">
                           {selectedAssessment.overallPerformance.managerRating}
                         </div>
                      ) : (
                        <select 
                            value={selectedAssessment.overallPerformance.managerRating || ''}
                            onChange={(e) => handleManagerRatingChange('overallRating', e.target.value as Rating)}
                            className="w-full text-sm border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-brand-500 outline-none"
                        >
                            <option value="">Select Final Rating</option>
                            {Object.values(Rating).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </div>
                    
                    {!isReviewed && (
                      <button 
                        onClick={handleFinalSubmit}
                        className="px-8 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg self-end"
                      >
                        Confirm & Complete Review
                      </button>
                    )}
                  </div>
                </div>

                {/* Print Signatures */}
                <div className="mt-16 hidden print:grid grid-cols-2 gap-20">
                    <div className="border-t border-slate-300 pt-4">
                       <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Assessor Signature</span>
                       <div className="h-10"></div>
                       <span className="text-xs font-bold text-slate-800">Date: ________________</span>
                    </div>
                    <div className="border-t border-slate-300 pt-4">
                       <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Staff Signature</span>
                       <div className="h-10"></div>
                       <span className="text-xs font-bold text-slate-800">Date: ________________</span>
                    </div>
                </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6 print:hidden">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-28">
               <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                 <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                 </svg>
                 Employee Summary
               </h4>
               <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Self-Appraisal Intro</span>
                    <div className="text-xs text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100 italic leading-relaxed">
                      "{selectedAssessment.overallPerformance.selfComments || 'No overall summary provided.'}"
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Staff Self Rating</span>
                    <div className="text-sm font-bold text-brand-700 bg-brand-50 px-3 py-2 rounded-lg border border-brand-100 inline-block">
                      {selectedAssessment.overallPerformance.selfRating || 'No self-rating given'}
                    </div>
                  </div>
                  {isReviewed && (
                    <div className="pt-4 border-t border-slate-100">
                       <div className="p-4 bg-green-50 border border-green-100 rounded-lg text-green-700">
                         <div className="text-[10px] font-black uppercase tracking-widest mb-1">Status</div>
                         <div className="text-sm font-bold">Review Finalized</div>
                         <p className="text-[10px] mt-2 leading-tight">This assessment is now archived. You can export it as a PDF for the employee's HR records.</p>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'reviewed': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
       <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Division</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assessments.filter(a => a.status !== 'draft').map(a => (
              <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs">
                      {a.employeeDetails.fullName ? a.employeeDetails.fullName.split(' ').map(n => n[0]).join('') : 'EM'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{a.employeeDetails.fullName || 'Unnamed Staff'}</p>
                      <p className="text-[10px] text-slate-400">{a.employeeDetails.position || 'No Position'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-slate-600">{a.employeeDetails.division || 'Unassigned'}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(a.status)}`}>
                    {a.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-3">
                    {a.status === 'reviewed' && (
                       <button 
                        onClick={() => { handleReviewClick(a); setTimeout(() => window.print(), 100); }}
                        className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors"
                        title="Download Final PDF"
                       >
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                       </button>
                    )}
                    <button 
                      onClick={() => handleReviewClick(a)}
                      className="text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors"
                    >
                      {a.status === 'submitted' ? 'Review Submission' : 'View Full Report'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {assessments.filter(a => a.status !== 'draft').length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                  No submissions pending review.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Pending Reviews</h5>
            <p className="text-3xl font-black text-slate-800">{assessments.filter(a => a.status === 'submitted').length}</p>
         </div>
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Completed Total</h5>
            <p className="text-3xl font-black text-slate-800">{assessments.filter(a => a.status === 'reviewed').length}</p>
         </div>
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Archived Records</h5>
            <p className="text-3xl font-black text-slate-800">12</p>
         </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
