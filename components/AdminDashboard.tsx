
import React, { useState } from 'react';
import { Assessment, Rating, KPI } from '../types.ts';
import { analyzeAssessment } from '../services/geminiService.ts';
import { RATING_DESCRIPTIONS } from '../constants.ts';

interface AdminDashboardProps {
  assessments: Assessment[];
  onReviewComplete: (updated: Assessment) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ assessments, onReviewComplete }) => {
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleReviewClick = (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    setAiAnalysis('');
  };

  const runAiAnalysis = async (assessment: Assessment) => {
    setIsAnalyzing(true);
    const analysis = await analyzeAssessment(assessment);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
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
        <button 
          onClick={() => setSelectedAssessment(null)}
          className="text-sm font-bold text-brand-600 flex items-center gap-1 hover:underline"
        >
          &larr; Back to Submissions
        </button>

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
                    
                    {/* Mid-Year Section in Admin */}
                    <div className="mb-6 p-3 bg-white border border-slate-200 rounded-md">
                      <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Mid-Year Review Review</h6>
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

                    {/* Annual Section in Admin */}
                    <div className="p-3 bg-brand-50/30 border border-brand-100 rounded-md">
                      <h6 className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-3">Annual Review Review</h6>
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

              {/* Competency Overview (Summary View for Admin) */}
              <div className="mt-12 space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b pb-2">Core Competencies Comparison</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedAssessment.coreCompetencies.map(comp => (
                    <div key={comp.id} className="text-xs flex justify-between p-2 border-b border-slate-50">
                      <span className="text-slate-600 font-medium">{comp.name}</span>
                      <div className="flex gap-4">
                         <span className="text-brand-600 font-bold">Self: {comp.selfRating || 'N/A'}</span>
                         <div className="w-24">
                            <select 
                              value={comp.managerRating || ''}
                              onChange={(e) => {
                                const updated = {
                                  ...selectedAssessment,
                                  coreCompetencies: selectedAssessment.coreCompetencies.map(c => c.id === comp.id ? { ...c, managerRating: e.target.value as Rating } : c)
                                };
                                setSelectedAssessment(updated);
                              }}
                              className="w-full border rounded p-0.5 outline-none focus:ring-1 focus:ring-brand-500"
                            >
                               <option value="">Rate</option>
                               {Object.values(Rating).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                         </div>
                      </div>
                    </div>
                  ))}
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

          {/* AI Tools Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-brand-900 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h4 className="font-bold text-lg">AI Performance Analyst</h4>
              </div>
              <p className="text-xs text-brand-200 mb-6">Get an instant AI-powered summary and rating suggestion based on the employee's self-assessment data.</p>
              
              <button 
                onClick={() => runAiAnalysis(selectedAssessment)}
                disabled={isAnalyzing}
                className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all border border-brand-500 ${isAnalyzing ? 'bg-brand-800 opacity-50' : 'bg-brand-600 hover:bg-brand-500'}`}
              >
                {isAnalyzing ? 'Analyzing Data...' : 'Analyze Submission'}
              </button>

              {aiAnalysis && (
                <div className="mt-6 p-4 bg-brand-950 rounded border border-brand-800 text-brand-50 text-xs leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-2 duration-500">
                  {aiAnalysis}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200">
               <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider">Employee Self-Reflection</h4>
               <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Development Goals</span>
                    <p className="text-xs text-slate-600 mt-1 italic">{selectedAssessment.developmentPlan.selfComments || 'No comments provided.'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Overall Summary</span>
                    <p className="text-xs text-slate-600 mt-1 italic">{selectedAssessment.overallPerformance.selfComments || 'No summary provided.'}</p>
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
