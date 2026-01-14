
import React, { useState, useRef } from 'react';
import { Assessment, Rating, RoleType } from '../types.ts';
import { createBlankAssessment } from '../constants.ts';
import AppraisalReport from './AppraisalReport.tsx';

interface AdminDashboardProps {
  assessments: Assessment[];
  currentUserEmail: string;
  role: RoleType;
  onReviewComplete: (updated: Assessment) => void;
  onBulkUpload: (newAssessments: Assessment[]) => void;
  onDeleteAssessment: (id: string) => void;
  onRestoreBackup?: (assessments: Assessment[]) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  assessments, 
  currentUserEmail, 
  role, 
  onReviewComplete,
  onBulkUpload,
  onDeleteAssessment,
  onRestoreBackup
}) => {
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [activeTab, setActiveTab] = useState<'submissions' | 'management'>(
    assessments.length === 0 && role === 'admin' ? 'management' : 'submissions'
  );
  const [isDownloading, setIsDownloading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

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
          if (row.length < 9) return;
          const [name, email, k1, k2, k3, k4, k5, mName, mEmail, mPass] = row;
          newEntries.push(createBlankAssessment(name, email.toLowerCase(), mName, mEmail.toLowerCase(), [k1, k2, k3, k4, k5], mPass));
        });
        if (newEntries.length > 0) {
          onBulkUpload(newEntries);
          alert(`Successfully updated ${newEntries.length} staff records.`);
          setActiveTab('submissions');
        }
      } catch (err: any) { alert(`Error: ${err.message}`); }
      finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
    };
    reader.readAsText(file);
  };

  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(assessments));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `metabev_system_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleExportExcel = () => {
    const completed = assessments.filter(a => a.status === 'reviewed');
    if (completed.length === 0) {
      alert("No completed assessments found to export.");
      return;
    }

    const headers = [
      'Staff Name', 'Staff Email', 'Position', 'Division', 'Manager', 'Final Rating', 'Manager Summary',
      'KPI 1 Rating', 'KPI 1 Manager Comment',
      'KPI 2 Rating', 'KPI 2 Manager Comment',
      'KPI 3 Rating', 'KPI 3 Manager Comment',
      'KPI 4 Rating', 'KPI 4 Manager Comment',
      'KPI 5 Rating', 'KPI 5 Manager Comment',
      'Development Plan Comment'
    ];

    const rows = completed.map(a => {
      const row = [
        a.employeeDetails.fullName,
        a.employeeDetails.email,
        a.employeeDetails.position,
        a.employeeDetails.division,
        a.managerName,
        a.overallPerformance.managerRating || 'N/A',
        a.overallPerformance.managerComments || '',
      ];

      for (let i = 0; i < 5; i++) {
        const kpi = a.kpis[i];
        row.push(kpi?.managerRating || 'N/A');
        row.push(kpi?.managerComments || '');
      }

      row.push(a.developmentPlan.managerComments || '');
      return row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `MetaBev_Completed_Assessments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const restoredData = JSON.parse(text);
        if (!Array.isArray(restoredData)) throw new Error("Invalid backup format.");
        if (onRestoreBackup) onRestoreBackup(restoredData);
      } catch (err: any) {
        alert("Could not restore backup: " + err.message);
      } finally {
        if (backupInputRef.current) backupInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadPDF = (name: string) => {
    const element = document.getElementById('appraisal-report');
    if (!element) return;
    
    setIsDownloading(true);
    const opt = {
      margin: 10,
      filename: `MetaBev_Appraisal_${name.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // @ts-ignore
    html2pdf().set(opt).from(element).save().then(() => {
      setIsDownloading(false);
    });
  };

  const downloadTemplate = () => {
    const headers = ['FullName', 'Email', 'KPI1_Description', 'KPI2_Description', 'KPI3_Description', 'KPI4_Description', 'KPI5_Description', 'ManagerName', 'ManagerEmail', 'ManagerPassword'];
    const rows = [
      ['Sample Employee', 'employee@example.com', 'Description 1', 'Description 2', 'Description 3', 'Description 4', 'Description 5', 'Sample Manager', 'manager@example.com', 'manager123']
    ];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(r => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "metabev_staff_registry_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (selectedAssessment) {
    const isReviewed = selectedAssessment.status === 'reviewed';
    return (
      <div className="space-y-8 animate-in fade-in duration-300 pb-20">
        <div className="flex justify-between items-center no-print">
          <button onClick={() => setSelectedAssessment(null)} className="text-sm font-bold text-brand-600 hover:underline flex items-center gap-1">
            &larr; Back to Dashboard
          </button>
          
          <div className="flex gap-3">
            {isReviewed && (
              <button 
                onClick={() => handleDownloadPDF(selectedAssessment.employeeDetails.fullName)} 
                disabled={isDownloading}
                className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
              </button>
            )}
          </div>
        </div>
        
        <AppraisalReport 
          assessment={selectedAssessment}
          isEditable={!isReviewed}
          isDownloading={isDownloading}
          onUpdate={setSelectedAssessment}
          onFinalize={(final) => {
            onReviewComplete(final);
            setSelectedAssessment(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
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
             <button onClick={handleExportExcel} className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">
               Export Completed (Excel)
             </button>
             <button onClick={handleExportBackup} className="bg-brand-50 border border-brand-200 text-brand-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-brand-100 transition-colors">
               Export Backup
             </button>
             <button onClick={() => backupInputRef.current?.click()} className="bg-brand-50 border border-brand-200 text-brand-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-brand-100 transition-colors">
               Restore Backup
             </button>
             <input type="file" accept=".json" ref={backupInputRef} onChange={handleRestoreBackup} className="hidden" />
             <div className="w-px h-8 bg-slate-200 mx-2 hidden md:block"></div>
             <button onClick={downloadTemplate} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors">
               Get Template
             </button>
             <button onClick={() => fileInputRef.current?.click()} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors">
               Upload Registry
             </button>
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
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Rating</th>
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
                  <p className="text-xs font-bold text-slate-800">
                    {a.overallPerformance.managerRating || <span className="text-slate-300 font-normal italic">Pending Review</span>}
                  </p>
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
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
