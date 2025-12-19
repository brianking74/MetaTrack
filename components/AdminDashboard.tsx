
import React, { useState } from 'react';
import { Assessment, Rating, KPI } from '../types.ts';
import { RATING_DESCRIPTIONS } from '../constants.ts';

interface AdminDashboardProps {
  assessments: Assessment[];
  onReviewComplete: (updated: Assessment) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ assessments, onReviewComplete }) => {
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);

  const handleReviewClick = (assessment: Assessment) => {
    setSelectedAssessment(assessment);
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
    setSelectedAssessment(null);
  };

  if (selectedAssessment) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <button 
            onClick={() => setSelectedAssessment(null)}
            className="text-sm font-bold text-brand-600 flex items-center gap-1 hover:underline"
          >
            &larr; Back to Submissions
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Reviewing: {selectedAssessment.employeeDetails.fullName}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Review Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-800">{selectedAssessment.employeeDetails.fullName}</h3>
                <span className="text-sm font-medium text-slate-500">{selectedAssessment.employeeDetails.position}</span>
              </div>

              {/* KPI Review */}
              <div className="space-y-8">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b pb-2">KPI Assessment</h4>
                {selectedAssessment.kpis.map((kpi, idx) => (
                  <div key={kpi.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-start mb-3">
                      <h5 className="font-bold text-slate-700">{idx + 1}. {kpi.title}</h5>
                    </div>
                    
                    <div className="mb-6 p-3 bg-white border border-slate-200 rounded-md">
                      <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Mid-Year Review</h6>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Staff Mid-Year Comments</label>
                          <p className="text-xs text-slate-700 italic bg-slate-50 p-2 rounded min-h-[40px]">
                            {kpi.midYearSelfComments || 'No comments provided.'}
                          </p>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Manager Mid-Year Comments</label>
                          <textarea 
                            value={kpi.midYearManagerComments || ''}
                            onChange={(e) => updateSelectedKPI(kpi.id, { midYearManagerComments: e.target.value })}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-brand-500 outline-none h-16 resize-none"
                            placeholder="Add mid-year feedback..."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-brand-50/30 border border-brand-100 rounded-md">
                      <h6 className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-3">Annual Review</h6>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded font-medium">Self Rating: {kpi.selfRating || 'N/A'}</span>
                      </div>
                      <p className="text-xs text-slate-500 italic mb-4">Staff Year-End comments: {kpi.selfComments || 'None'}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1 uppercase">Manager Annual Rating</label>
                          <select 
                            value={kpi.managerRating || ''}
                            onChange={(e) => handleManagerRatingChange('managerRating', e.target.value as Rating, kpi.id)}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-brand-500 outline-none"
                          >
                            <option value="">Select Rating</option>
                            {Object.values(Rating).map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1 uppercase">Manager Annual Comments</label>
                          <textarea 
                            value={kpi.managerComments || ''}
                            onChange={(e) => updateSelectedKPI(kpi.id, { managerComments: e.target.value })}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-brand-500 outline-none h-16 resize-none"
                            placeholder="Provide final feedback..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Core Competencies Comparison - Reformatted to Single Column for Tidiness */}
              <div className="mt-12 space-y-6">
                <h4 className="text-[16px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-4 mb-4">
                  Core Competencies Comparison
                </h4>
                <div className="divide-y divide-slate-50">
                  {selectedAssessment.coreCompetencies.map(comp => (
                    <div key={comp.id} className="flex items-center justify-between py-5 gap-6">
                      <div className="flex-1">
                        <span className="text-sm font-bold text-slate-700 block">{comp.name}</span>
                      </div>
                      <div className="flex items-center gap-10">
                         <div className="whitespace-nowrap">
                            <span className="text-sm font-bold text-brand-700">Self: {comp.selfRating || 'N/A'}</span>
                         </div>
                         <div className="w-40 relative">
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
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                               </svg>
                            </div>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual Development Review */}
              <div className="mt-16 space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b pb-2">Individual Development Review</h4>
                <div className="p-6 bg-white rounded-lg border border-slate-200">
                  <div className="mb-4">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Staff Development Reflection</label>
                    <p className="text-sm text-slate-700 italic bg-slate-50 p-4 rounded min-h-[60px]">
                      {selectedAssessment.developmentPlan.selfComments || 'No comments provided.'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Assessor Development Feedback</label>
                    <textarea 
                      value={selectedAssessment.developmentPlan.managerComments || ''}
                      onChange={(e) => setSelectedAssessment({
                        ...selectedAssessment,
                        developmentPlan: { ...selectedAssessment.developmentPlan, managerComments: e.target.value }
                      })}
                      className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:ring-1 focus:ring-brand-500 outline-none h-32 resize-none"
                      placeholder="Provide feedback on development and growth..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b pb-2 mb-6">Final Recommendation</h4>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Overall Manager Comments</label>
                    <textarea 
                      value={selectedAssessment.overallPerformance.managerComments}
                      onChange={(e) => setSelectedAssessment({ ...selectedAssessment, overallPerformance: { ...selectedAssessment.overallPerformance, managerComments: e.target.value } })}
                      className="w-full border border-slate-300 rounded-lg p-4 text-sm focus:ring-2 focus:ring-brand-500 outline-none h-32"
                      placeholder="Enter the final performance summary and manager's perspective..."
                    />
                  </div>
                  <div className="max-w-md">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Final Overall Performance Rating</label>
                    <select 
                        value={selectedAssessment.overallPerformance.managerRating || ''}
                        onChange={(e) => handleManagerRatingChange('overallRating', e.target.value as Rating)}
                        className="w-full text-sm border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-brand-500 outline-none"
                    >
                        <option value="">Select Final Rating</option>
                        {Object.values(Rating).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button 
                    onClick={handleFinalSubmit}
                    className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg"
                  >
                    Confirm & Complete Review
                  </button>
                </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-28">
               <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                 <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                 </svg>
                 Employee Self-Reflection
               </h4>
               <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Development Focus</span>
                    <div className="text-xs text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100 italic leading-relaxed">
                      {selectedAssessment.developmentPlan.selfComments || 'No development comments provided.'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Performance Summary</span>
                    <div className="text-xs text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100 italic leading-relaxed">
                      {selectedAssessment.overallPerformance.selfComments || 'No overall summary provided.'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Self Rating</span>
                    <div className="text-sm font-bold text-brand-700 bg-brand-50 px-3 py-2 rounded-lg border border-brand-100">
                      {selectedAssessment.overallPerformance.selfRating || 'No self-rating given'}
                    </div>
                  </div>
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
                  <button 
                    onClick={() => handleReviewClick(a)}
                    className="text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors"
                  >
                    {a.status === 'submitted' ? 'Review Submission' : 'View Result'}
                  </button>
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
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Completed Today</h5>
            <p className="text-3xl font-black text-slate-800">{assessments.filter(a => a.status === 'reviewed').length}</p>
         </div>
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Staff</h5>
            <p className="text-3xl font-black text-slate-800">12</p>
         </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
