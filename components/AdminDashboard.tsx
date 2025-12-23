
import React, { useState, useRef } from 'react';
import { Assessment, Rating, KPI, RoleType } from '../types.ts';
import { createBlankAssessment } from '../constants.ts';

interface AdminDashboardProps {
  assessments: Assessment[];
  currentUserEmail: string;
  role: RoleType;
  onReviewComplete: (updated: Assessment) => void;
  onBulkUpload: (newAssessments: Assessment[]) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  assessments, 
  currentUserEmail, 
  role, 
  onReviewComplete,
  onBulkUpload
}) => {
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  
  // Default to 'management' if no data exists and user is super-admin
  const [activeTab, setActiveTab] = useState<'submissions' | 'management'>(
    assessments.length === 0 && role === 'admin' ? 'management' : 'submissions'
  );
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter based on role
  const filteredAssessments = role === 'admin' 
    ? assessments 
    : assessments.filter(a => a.managerEmail.toLowerCase() === currentUserEmail.toLowerCase());

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').filter(row => row.trim() !== "");
      const newEntries: Assessment[] = [];

      // Skip header row
      rows.slice(1).forEach(row => {
        const columns = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (columns.length < 9) return;

        const [name, email, k1, k2, k3, k4, k5, mName, mEmail] = columns;
        if (!email || !mEmail) return;

        newEntries.push(createBlankAssessment(name, email, mName, mEmail, [k1, k2, k3, k4, k5]));
      });

      if (newEntries.length > 0) {
        onBulkUpload(newEntries);
        alert(`Successfully imported ${newEntries.length} staff records.`);
        setActiveTab('submissions');
      } else {
        alert("Could not find any valid rows in the CSV. Please check the format.");
      }
    };
    reader.readAsText(file);
  };

  const updateSelectedKPI = (kpiId: string, updates: Partial<KPI>) => {
    if (!selectedAssessment) return;
    const updated = {
      ...selectedAssessment,
      kpis: selectedAssessment.kpis.map(k => k.id === kpiId ? { ...k, ...updates } : k)
    };
    setSelectedAssessment(updated);
  };

  const handleManagerRatingChange = (value: Rating, kpiId?: string) => {
    if (!selectedAssessment) return;
    if (kpiId) {
      updateSelectedKPI(kpiId, { managerRating: value });
    } else {
      setSelectedAssessment({
        ...selectedAssessment,
        overallPerformance: { ...selectedAssessment.overallPerformance, managerRating: value }
      });
    }
  };

  const handleFinalSubmit = () => {
    if (!selectedAssessment) return;
    onReviewComplete({ ...selectedAssessment, status: 'reviewed' });
    setSelectedAssessment({ ...selectedAssessment, status: 'reviewed' });
  };

  const handleSendToStaff = () => {
    if (!selectedAssessment) return;
    setIsSending(true);
    const { fullName, email } = selectedAssessment.employeeDetails;
    const rating = selectedAssessment.overallPerformance.managerRating || 'N/A';
    const subject = encodeURIComponent(`Final Performance Review - ${fullName}`);
    const body = encodeURIComponent(`Dear ${fullName},\n\nYour performance review is complete.\nFinal Rating: ${rating}\n\nPlease login to the METABEV Portal to view feedback.`);
    
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    
    setTimeout(() => {
      setIsSending(false);
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    }, 1000);
  };

  if (selectedAssessment) {
    const isReviewed = selectedAssessment.status === 'reviewed';
    return (
      <div className="space-y-6 print:m-0 print:p-0">
        <div className="flex justify-between items-center print:hidden">
          <button onClick={() => setSelectedAssessment(null)} className="text-sm font-bold text-brand-600 flex items-center gap-1 hover:underline">
            &larr; Back to Dashboard
          </button>
          <div className="flex items-center gap-4">
            {isReviewed && (
              <>
                <button onClick={() => window.print()} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold flex items-center gap-2">
                  Download PDF
                </button>
                <button onClick={handleSendToStaff} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold">
                  {sendSuccess ? 'Email Client Opened' : 'Send to Staff'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm print:border-none">
              <div className="border-b pb-6 mb-6">
                <h3 className="text-2xl font-bold text-slate-800">{selectedAssessment.employeeDetails.fullName}</h3>
                <p className="text-sm text-slate-500">{selectedAssessment.employeeDetails.email}</p>
                <div className="mt-2 text-xs font-bold text-slate-400">Assigned Manager: {selectedAssessment.managerName}</div>
              </div>

              {/* KPI Review Section */}
              <div className="space-y-8">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Personalized KPIs</h4>
                {selectedAssessment.kpis.map((kpi, idx) => (
                  <div key={kpi.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100 mb-4">
                    <h5 className="font-bold text-slate-700">{idx + 1}. {kpi.title}</h5>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-white p-3 rounded border border-slate-200">
                        <span className="text-[9px] font-bold text-slate-400 block mb-1">STAFF COMMENTS</span>
                        <p className="text-xs italic text-slate-600">"{kpi.selfComments || 'Pending staff input...'}"</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block mb-1">ASSESSOR FEEDBACK</span>
                        {isReviewed ? (
                          <p className="text-xs text-slate-800 bg-brand-50 p-2 rounded">{kpi.managerComments}</p>
                        ) : (
                          <textarea 
                            value={kpi.managerComments}
                            onChange={(e) => updateSelectedKPI(kpi.id, { managerComments: e.target.value })}
                            className="w-full text-xs border rounded p-2 h-16 outline-none focus:ring-1 focus:ring-brand-500"
                            placeholder="Add manager feedback..."
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Final Review Section */}
              <div className="mt-12 pt-12 border-t">
                <h4 className="text-xs font-black uppercase text-slate-400 mb-4">Final Recommendation</h4>
                <div className="space-y-4">
                  <textarea 
                    value={selectedAssessment.overallPerformance.managerComments}
                    readOnly={isReviewed}
                    onChange={(e) => setSelectedAssessment({...selectedAssessment, overallPerformance: {...selectedAssessment.overallPerformance, managerComments: e.target.value}})}
                    className={`w-full border rounded-lg p-4 text-sm h-32 outline-none ${isReviewed ? 'bg-slate-50' : 'focus:ring-2 focus:ring-brand-500'}`}
                    placeholder="Enter final appraisal summary..."
                  />
                  {!isReviewed && (
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
                      <select 
                        value={selectedAssessment.overallPerformance.managerRating || ''}
                        onChange={(e) => handleManagerRatingChange(e.target.value as Rating)}
                        className="text-sm border rounded p-2 outline-none"
                      >
                        <option value="">Select Final Rating</option>
                        {Object.values(Rating).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button onClick={handleFinalSubmit} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold">Complete Review</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Staff Submission Status</h4>
              <div className={`p-4 rounded-lg text-sm font-bold border ${selectedAssessment.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                {selectedAssessment.status.toUpperCase()}
              </div>
              <div className="mt-4">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">STAFF SELF-RATING</span>
                <span className="text-sm font-black text-brand-700">{selectedAssessment.overallPerformance.selfRating || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Navigation and Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('submissions')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'submissions' ? 'text-brand-600' : 'text-slate-400'}`}
          >
            Submissions ({filteredAssessments.length})
            {activeTab === 'submissions' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600 rounded-t-full"></div>}
          </button>
          
          {role === 'admin' && (
            <button 
              onClick={() => setActiveTab('management')}
              className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'management' ? 'text-brand-600' : 'text-slate-400'}`}
            >
              Staff Registry Management
              {activeTab === 'management' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600 rounded-t-full"></div>}
            </button>
          )}
        </div>

        {role === 'admin' && activeTab === 'submissions' && (
          <button 
            onClick={() => setActiveTab('management')}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import Staff (CSV)
          </button>
        )}
      </div>

      {activeTab === 'submissions' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Staff Member</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Assigned Manager</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAssessments.filter(a => a.status !== 'draft').map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-800">{a.employeeDetails.fullName}</p>
                    <p className="text-[10px] text-slate-400">{a.employeeDetails.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-600">{a.managerName}</p>
                    <p className="text-[9px] text-slate-400">{a.managerEmail}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {a.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setSelectedAssessment(a)} className="text-xs font-bold text-brand-600 hover:underline">
                      {a.status === 'reviewed' ? 'View Report' : 'Review Now'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredAssessments.filter(a => a.status !== 'draft').length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="max-w-xs mx-auto space-y-4">
                      <p className="text-slate-400 italic text-sm">No submissions have been made yet.</p>
                      {role === 'admin' && (
                        <button 
                          onClick={() => setActiveTab('management')}
                          className="text-brand-600 font-bold text-xs underline"
                        >
                          Go to Staff Registry to import employees &rarr;
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto py-12">
          <div className="text-center bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 hover:border-brand-300 transition-colors">
            <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Import Staff Registry</h3>
            <p className="text-sm text-slate-500 mb-8">Upload a CSV file with Staff Name, Email, KPIs (1-5), and Manager details.</p>
            
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              onChange={handleCsvUpload} 
              className="hidden" 
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="px-10 py-4 bg-brand-600 text-white rounded-xl font-bold shadow-lg hover:bg-brand-700 transition-all flex items-center gap-3 mx-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Select CSV File
            </button>
            
            <div className="mt-12 text-left">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Required CSV Format</h4>
              <div className="bg-slate-50 p-4 rounded-lg font-mono text-[9px] text-slate-500 overflow-x-auto whitespace-nowrap border border-slate-200">
                Staff Name, Staff Email Address, KPI1, KPI2, KPI3, KPI4, KPI5, Manager's Name, Manager's Email
              </div>
              <p className="mt-4 text-[10px] text-slate-400 italic">
                * Personalized KPIs will be pre-filled for each staff member upon login.
              </p>
            </div>
          </div>
          
          <div className="mt-8 p-6 bg-brand-50 rounded-2xl border border-brand-100 flex gap-4 items-center">
             <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <div>
                <p className="text-xs font-bold text-brand-900">Multi-Manager Visibility</p>
                <p className="text-[10px] text-brand-700 opacity-80 mt-0.5">Managers only see staff assigned to them via the 'Manager Email' column. Super Admins see everyone.</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
