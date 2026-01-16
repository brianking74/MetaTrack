
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

  const handleDownloadBackup = () => {
    const dataStr = JSON.stringify(assessments, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MetaBev_System_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const completed = assessments.filter(a => a.status === 'reviewed');
    if (completed.length === 0) { alert("No completed assessments found."); return; }
    
    const headers = [
      'Staff Name', 'Staff Email', 'Position', 'Division', 'Manager',
      'KPI 1 Title', 'KPI 1 Self Rating', 'KPI 1 Self Comments', 'KPI 1 Mgr Rating', 'KPI 1 Mgr Comments',
      'KPI 2 Title', 'KPI 2 Self Rating', 'KPI 2 Self Comments', 'KPI 2 Mgr Rating', 'KPI 2 Mgr Comments',
      'KPI 3 Title', 'KPI 3 Self Rating', 'KPI 3 Self Comments', 'KPI 3 Mgr Rating', 'KPI 3 Mgr Comments',
      'KPI 4 Title', 'KPI 4 Self Rating', 'KPI 4 Self Comments', 'KPI 4 Mgr Rating', 'KPI 4 Mgr Comments',
      'KPI 5 Title', 'KPI 5 Self Rating', 'KPI 5 Self Comments', 'KPI 5 Mgr Rating', 'KPI 5 Mgr Comments',
      'Work Effectiveness Self', 'Work Effectiveness Mgr', 'Work Effectiveness Comments',
      'Innovation Self', 'Innovation Mgr', 'Innovation Comments',
      'Analysing Self', 'Analysing Mgr', 'Analysing Comments',
      'Customer Focused Self', 'Customer Focused Mgr', 'Customer Focused Comments',
      'Results Orientation Self', 'Results Orientation Mgr', 'Results Orientation Comments',
      'Ownership Self', 'Ownership Mgr', 'Ownership Comments',
      'IDP Staff Goals', 'IDP Assessor Roadmap',
      'Staff Final Summary', 'Final Official Rating', 'Manager Executive Narrative',
      'Reviewed At'
    ];

    const rows = completed.map(a => {
      const rowData: any[] = [
        a.employeeDetails.fullName,
        a.employeeDetails.email,
        a.employeeDetails.position,
        a.employeeDetails.division,
        a.managerName
      ];

      for (let i = 0; i < 5; i++) {
        const k = a.kpis[i];
        if (k) {
          rowData.push(k.title, k.selfRating || 'N/A', k.selfComments || '', k.managerRating || 'N/A', k.managerComments || '');
        } else {
          rowData.push('', '', '', '', '');
        }
      }

      a.coreCompetencies.forEach(c => {
        rowData.push(c.selfRating || 'N/A', c.managerRating || 'N/A', c.managerComments || '');
      });

      rowData.push(a.developmentPlan.selfComments || '', a.developmentPlan.managerComments || '');

      rowData.push(
        a.overallPerformance.selfComments || '',
        a.overallPerformance.managerRating || 'N/A',
        a.overallPerformance.managerComments || '',
        a.reviewedAt || 'N/A'
      );

      return rowData.map(val => {
        const str = String(val === undefined || val === null ? '' : val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(",");
    });

    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `MetaBev_Comprehensive_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleDownloadPDF = (name: string) => {
    const element = document.getElementById('appraisal-report');
    if (!element) return;
    setIsDownloading(true);
    
    // @ts-ignore
    const opt = {
      margin: 10,
      filename: `Appraisal_${name.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    // @ts-ignore
    html2pdf().set(opt).from(element).save().then(() => setIsDownloading(false));
  };

  if (selectedAssessment) {
    const isReviewed = selectedAssessment.status === 'reviewed';
    return (
      <div className="space-y-8 animate-in fade-in duration-300 pb-20">
        <div className="flex justify-between items-center no-print">
          <button onClick={() => setSelectedAssessment(null)} className="text-sm font-bold text-brand-600 hover:underline flex items-center gap-1">
            &larr; Back to Dashboard
          </button>
          <div className="flex gap-4 items-center">
            {isReviewed && (
              <span className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full border">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Record Locked
              </span>
            )}
            {isReviewed && (
              <button onClick={() => handleDownloadPDF(selectedAssessment.employeeDetails.fullName)} disabled={isDownloading} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50">
                {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
              </button>
            )}
          </div>
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
             {activeTab === 'management' && (
               <button onClick={handleDownloadBackup} title="Export entire system state as JSON" className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-2">
                 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                 System Backup
               </button>
             )}
             {activeTab === 'management' && assessments.length > 0 && (
               <button onClick={onForceSync} disabled={isSyncing} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                 {isSyncing ? 'Syncing...' : 'Force Cloud Sync'}
               </button>
             )}
             <button onClick={handleExportExcel} className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">Export Report</button>
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
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Security</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Score</th>
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
                <td className="px-8 py-6 text-center">
                   {a.status === 'reviewed' ? (
                     <span className="inline-block" title="This record is finalized and cannot be edited.">
                       <svg className="w-4 h-4 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                     </span>
                   ) : (
                     <svg className="w-4 h-4 text-slate-200 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                   )}
                </td>
                <td className="px-8 py-6">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${a.status === 'reviewed' ? 'bg-green-50 text-green-700 border-green-200' : a.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-8 py-6 text-center">
                  {a.overallPerformance.managerRating ? (
                    <span className="text-sm font-black text-slate-800">
                      {a.overallPerformance.managerRating.split(' - ')[0]}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Pending</span>
                  )}
                </td>
                <td className="px-8 py-6 text-right">
                   <div className="flex justify-end gap-3">
                    <button onClick={() => setSelectedAssessment(a)} className="text-xs font-black text-brand-600 uppercase tracking-widest hover:underline">
                      {a.status === 'draft' ? 'View Details' : a.status === 'reviewed' ? 'View Report' : 'Review & Rate'}
                    </button>
                    {activeTab === 'management' && role === 'admin' && a.status === 'draft' && (
                      <button onClick={() => onDeleteAssessment(a.id)} className="text-xs font-black text-red-400 uppercase tracking-widest hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Delete
                      </button>
                    )}
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
