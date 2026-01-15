
import { Assessment, RoleType } from '../types.ts';
import { createBlankAssessment } from '../constants.ts';
import AppraisalReport from './AppraisalReport.tsx';
import React, { useState, useRef } from 'react';

interface AdminDashboardProps {
  assessments: Assessment[];
  currentUserEmail: string;
  role: RoleType;
  onReviewComplete: (updated: Assessment) => void;
  onBulkUpload: (newAssessments: Assessment[]) => void;
  onDeleteAssessment: (id: string) => void;
  onRestoreBackup?: (assessments: Assessment[]) => void;
  isSyncing?: boolean;
  onForceSync?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  assessments, 
  currentUserEmail, 
  role, 
  onReviewComplete,
  onBulkUpload,
  onDeleteAssessment,
  onRestoreBackup,
  isSyncing,
  onForceSync
}) => {
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [activeTab, setActiveTab] = useState<'submissions' | 'management'>(
    assessments.length === 0 && role === 'admin' ? 'management' : 'submissions'
  );
  const [isDownloading, setIsDownloading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredAssessments = role === 'admin' 
    ? assessments 
    : assessments.filter(a => a.managerEmail.toLowerCase().trim() === currentUserEmail.toLowerCase().trim());

  const submissionsCount = filteredAssessments.filter(a => a.status !== 'draft').length;
  const registryCount = filteredAssessments.length;

  const parseCSV = (text: string): string[][] => {
    if (text.charCodeAt(0) === 0xFEFF) text = text.substr(1);
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i+1];
      if (inQuotes) {
        if (char === '"' && nextChar === '"') { currentCell += '"'; i++; }
        else if (char === '"') { inQuotes = false; }
        else { currentCell += char; }
      } else {
        if (char === '"') { inQuotes = true; }
        else if (char === ',') { currentRow.push(currentCell.trim()); currentCell = ''; }
        else if (char === '\r' || char === '\n') {
          currentRow.push(currentCell.trim());
          if (currentRow.some(c => c !== '')) rows.push(currentRow);
          currentRow = []; currentCell = '';
          if (char === '\r' && nextChar === '\n') i++;
        } else { currentCell += char; }
      }
    }
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c !== '')) rows.push(currentRow);
    }
    return rows;
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const allRows = parseCSV(text);
        if (allRows.length < 2) throw new Error("The file is empty or missing data.");
        
        const dataRows = allRows.slice(1);
        const newEntries: Assessment[] = [];
        
        dataRows.forEach((row, idx) => {
          if (row.length < 2 || !row[1].includes('@')) return;
          const [name, email, k1, k2, k3, k4, k5, mName, mEmail, mPass] = row;
          newEntries.push(createBlankAssessment(
            name || "No Name", 
            email.toLowerCase(), 
            mName || "No Manager", 
            mEmail?.toLowerCase() || "", 
            [k1, k2, k3, k4, k5].filter(Boolean), 
            mPass
          ));
        });

        if (newEntries.length > 0) {
          onBulkUpload(newEntries);
          setActiveTab('submissions');
        } else {
          alert("No valid entries were found in the CSV.");
        }
      } catch (err: any) { 
        alert(`CSV Upload Error: ${err.message}`); 
      }
      finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
    };
    reader.readAsText(file);
  };

  const handleExportExcel = () => {
    const completed = assessments.filter(a => a.status === 'reviewed');
    if (completed.length === 0) { alert("No completed assessments found."); return; }
    const headers = ['Staff Name', 'Staff Email', 'Position', 'Division', 'Manager', 'Final Rating', 'Manager Summary'];
    const rows = completed.map(a => [a.employeeDetails.fullName, a.employeeDetails.email, a.employeeDetails.position, a.employeeDetails.division, a.managerName, a.overallPerformance.managerRating || 'N/A', a.overallPerformance.managerComments || ''].map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));
    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `MetaBev_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleDownloadPDF = (name: string) => {
    const element = document.getElementById('appraisal-report');
    if (!element) return;
    setIsDownloading(true);
    // @ts-ignore
    html2pdf().set({ margin: 10, filename: `Appraisal_${name}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(element).save().then(() => setIsDownloading(false));
  };

  if (selectedAssessment) {
    const isReviewed = selectedAssessment.status === 'reviewed';
    return (
      <div className="space-y-8 animate-in fade-in duration-300 pb-20">
        <div className="flex justify-between items-center no-print">
          <button onClick={() => setSelectedAssessment(null)} className="text-sm font-bold text-brand-600 hover:underline flex items-center gap-1">
            &larr; Back to Dashboard
          </button>
          {isReviewed && (
            <button onClick={() => handleDownloadPDF(selectedAssessment.employeeDetails.fullName)} disabled={isDownloading} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50">
              {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
            </button>
          )}
        </div>
        <AppraisalReport assessment={selectedAssessment} isEditable={!isReviewed} isDownloading={isDownloading} onUpdate={setSelectedAssessment} onFinalize={(final) => { onReviewComplete(final); setSelectedAssessment(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4 no-print">
        <div className="flex gap-6">
          <button onClick={() => setActiveTab('submissions')} className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'submissions' ? 'text-brand-600' : 'text-slate-400'}`}>
            Submissions ({submissionsCount})
            {activeTab === 'submissions' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600"></div>}
          </button>
          <button onClick={() => setActiveTab('management')} className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'management' ? 'text-brand-600' : 'text-slate-400'}`}>
            Staff Registry ({registryCount})
            {activeTab === 'management' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600"></div>}
          </button>
        </div>
        
        {role === 'admin' && (
          <div className="flex flex-wrap gap-3">
             {activeTab === 'management' && assessments.length > 0 && (
               <button onClick={onForceSync} disabled={isSyncing} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                 {isSyncing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Syncing...
                    </>
                 ) : 'Force Cloud Sync'}
               </button>
             )}
             <button onClick={handleExportExcel} className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">Export Completed</button>
             <button onClick={() => fileInputRef.current?.click()} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors">Upload Registry</button>
             <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCsvUpload} className="hidden" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-xl border overflow-hidden no-print">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Member</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manager</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cloud</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(activeTab === 'submissions' 
              ? filteredAssessments.filter(a => a.status !== 'draft') 
              : filteredAssessments
            ).map(a => (
              <tr key={a.id} className="hover:bg-slate-50 group">
                <td className="px-8 py-6">
                  <p className="text-sm font-bold text-slate-800">{a.employeeDetails.fullName}</p>
                  <p className="text-[11px] text-slate-400">{a.employeeDetails.email}</p>
                </td>
                <td className="px-8 py-6">
                  <p className="text-xs font-bold text-slate-600">{a.managerName}</p>
                  <p className="text-[10px] text-slate-400">{a.managerEmail}</p>
                </td>
                <td className="px-8 py-6">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${a.status === 'reviewed' ? 'bg-green-50 text-green-700 border-green-200' : a.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-blue-400 animate-pulse' : 'bg-green-500'}`}></div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Synced</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                   <div className="flex justify-end gap-3">
                    <button onClick={() => setSelectedAssessment(a)} className="text-xs font-black text-brand-600 uppercase tracking-widest hover:underline">
                      {a.status === 'draft' ? 'View Details' : a.status === 'reviewed' ? 'View Report' : 'Review & Rate'}
                    </button>
                    {activeTab === 'management' && role === 'admin' && (
                      <button onClick={() => onDeleteAssessment(a.id)} className="text-xs font-black text-red-400 uppercase tracking-widest hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Delete
                      </button>
                    )}
                   </div>
                </td>
              </tr>
            ))}
            {filteredAssessments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-20 text-center">
                  <p className="text-slate-400 font-medium">No records found. {activeTab === 'management' ? 'Please upload your staff registry CSV.' : ''}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
