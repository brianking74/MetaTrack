
import { Assessment, RoleType, ExpenseClaim } from '../types.ts';
import { createBlankAssessment, EXPENSES_ENABLED, EXPENSE_GM_EMAIL } from '../constants.ts';
import AppraisalReport from './AppraisalReport.tsx';
import ManagerExpenses from './ManagerExpenses.tsx';
import AdminExpenses from './AdminExpenses.tsx';
import ExpenseClaims from './ExpenseClaims.tsx';
import ExpenseDashboard from './ExpenseDashboard.tsx';
import GmExpenses from './GmExpenses.tsx';
import { expensesService, claimGroupKey } from '../services/expenses.ts';
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AdminDashboardProps {
  assessments: Assessment[];
  currentUserEmail: string;
  role: RoleType;
  onReviewComplete: (updated: Assessment) => void;
  onUpdate: (updated: Assessment, immediate?: boolean) => void;
  onBulkUpload: (newAssessments: Assessment[]) => void;
  onDeleteAssessment: (id: string) => void;
  onRestoreBackup?: (assessments: Assessment[]) => void;
  isSyncing?: boolean;
  onForceSync?: () => void;
  // Routing for the signed-in manager's OWN expense claims (My Expenses tab):
  // their line manager on file, or the administrator when none is set.
  expenseProfile?: { staffName: string; managerEmail: string; managerName?: string };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  assessments, 
  currentUserEmail, 
  role, 
  onReviewComplete,
  onUpdate,
  onBulkUpload,
  onDeleteAssessment,
  onRestoreBackup,
  isSyncing,
  onForceSync,
  expenseProfile
}) => {
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [activeTab, setActiveTab] = useState<'submissions' | 'management' | 'expenses' | 'my-expenses' | 'dashboard' | 'gm-approvals'>(
    assessments.length === 0 && role === 'admin' ? 'management' : 'submissions'
  );
  const [isDownloading, setIsDownloading] = useState(false);

  // --- Expense claims state (manager: their team's claims; admin: all claims)
  const [expenseClaims, setExpenseClaims] = useState<ExpenseClaim[]>([]);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  const loadExpenseClaims = useCallback(async () => {
    if (!EXPENSES_ENABLED) return;
    setExpenseLoading(true);
    setExpenseError('');
    const { data, error } = await expensesService.getClaims();
    if (error) setExpenseError(error);
    setExpenseClaims(data);
    setExpenseLoading(false);
  }, []);

  useEffect(() => {
    if (EXPENSES_ENABLED && (role === 'manager' || role === 'admin')) {
      loadExpenseClaims();
    }
  }, [role, loadExpenseClaims]);

  // Badge counts CLAIMS (submissions), not line items - a 5-item claim is one claim to review.
  const pendingExpenseCount = new Set(
    expenseClaims.filter(c => c.status === 'submitted').map(claimGroupKey)
  ).size;
  const expenseTabLabel = role === 'manager'
    ? `Expenses (${pendingExpenseCount})`
    : `Expenses (${expenseClaims.length})`;

  // The General Manager gets a dedicated FINAL-approval tab: claims her line
  // managers already approved and are waiting on her. RLS feeds this tab
  // exactly the rows stamped with her email, so it stays empty for everyone
  // else and no claim data leaks sideways.
  const isGm = (currentUserEmail || '').toLowerCase() === EXPENSE_GM_EMAIL.toLowerCase();
  const gmPendingCount = new Set(
    expenseClaims.filter(c => c.status === 'pending_gm').map(claimGroupKey)
  ).size;
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredAssessments = role === 'admin' 
    ? assessments 
    : assessments.filter(a => a.managerEmail.toLowerCase().trim() === currentUserEmail.toLowerCase().trim());

  const submissionsCount = filteredAssessments.filter(a => a.status === 'submitted').length;
  const registryCount = filteredAssessments.length;

  const parseCSV = (text: string): string[][] => {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
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
        let invalidRows = 0;
        
        dataRows.forEach((row, idx) => {
          if (row.length < 2 || !row[1].includes('@')) { invalidRows++; return; }
          // Columns K/L (Manager/Employee Password) from the legacy template are
          // accepted but IGNORED - passwords are provisioned via Supabase Auth,
          // never stored in records.
          const [name, email, k1, k2, k3, k4, k5, devGoal, mName, mEmail] = row;
          if (!mEmail || !mEmail.includes('@')) { invalidRows++; return; } // manager email is required for portal access
          newEntries.push(createBlankAssessment(
            name || "No Name", 
            email.toLowerCase(), 
            mName || "No Manager", 
            mEmail.toLowerCase(), 
            [k1, k2, k3, k4, k5].filter(Boolean), 
            devGoal
          ));
        });

        if (newEntries.length > 0) {
          onBulkUpload(newEntries);
          setActiveTab('submissions');
          if (invalidRows > 0) alert(`${invalidRows} row(s) were skipped - each needs a valid staff email (column B) and manager email (column J).`);
        } else {
          alert("No valid entries were found in the CSV. Each row needs a staff email (column B) and a manager email (column J).");
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
    // Include everything staff/manager actually filled in: submitted + reviewed.
    // (Drafts are untouched templates and would only add noise.)
    const completed = assessments.filter(a => a.status === 'submitted' || a.status === 'reviewed');
    if (completed.length === 0) { alert("No submitted or reviewed assessments found."); return; }

    // Ratings are stored as long enum strings ("(1) SEE - Substantially
    // Exceeding Expectations"); export the compact form shown in the UI.
    const fmtRating = (r?: string) => (r ? String(r).split(' - ')[0] : 'N/A');

    // NOTE: mid-year reviews store their content in *midYear* fields
    // (midYearSelfComments / midYearManagerComments), NOT the final-year
    // fields. Both sets are exported so one file covers both review types.
    const headers = [
      'Staff Name', 'Staff Email', 'Position', 'Division', 'Manager', 'Manager Email',
      'Review Type', 'Status', 'Mid-Year Status',
      'KPI 1 Title', 'KPI 1 Description', 'KPI 1 Self Rating', 'KPI 1 Self Comments', 'KPI 1 Mgr Rating', 'KPI 1 Mgr Comments', 'KPI 1 Mid-Year Self', 'KPI 1 Mid-Year Mgr',
      'KPI 2 Title', 'KPI 2 Description', 'KPI 2 Self Rating', 'KPI 2 Self Comments', 'KPI 2 Mgr Rating', 'KPI 2 Mgr Comments', 'KPI 2 Mid-Year Self', 'KPI 2 Mid-Year Mgr',
      'KPI 3 Title', 'KPI 3 Description', 'KPI 3 Self Rating', 'KPI 3 Self Comments', 'KPI 3 Mgr Rating', 'KPI 3 Mgr Comments', 'KPI 3 Mid-Year Self', 'KPI 3 Mid-Year Mgr',
      'KPI 4 Title', 'KPI 4 Description', 'KPI 4 Self Rating', 'KPI 4 Self Comments', 'KPI 4 Mgr Rating', 'KPI 4 Mgr Comments', 'KPI 4 Mid-Year Self', 'KPI 4 Mid-Year Mgr',
      'KPI 5 Title', 'KPI 5 Description', 'KPI 5 Self Rating', 'KPI 5 Self Comments', 'KPI 5 Mgr Rating', 'KPI 5 Mgr Comments', 'KPI 5 Mid-Year Self', 'KPI 5 Mid-Year Mgr',
      'Work Effectiveness Self', 'Work Effectiveness Mgr', 'Work Effectiveness Comments', 'Work Effectiveness Mid-Year Self', 'Work Effectiveness Mid-Year Mgr',
      'Innovation Self', 'Innovation Mgr', 'Innovation Comments', 'Innovation Mid-Year Self', 'Innovation Mid-Year Mgr',
      'Analysing Self', 'Analysing Mgr', 'Analysing Comments', 'Analysing Mid-Year Self', 'Analysing Mid-Year Mgr',
      'Customer Focused Self', 'Customer Focused Mgr', 'Customer Focused Comments', 'Customer Focused Mid-Year Self', 'Customer Focused Mid-Year Mgr',
      'Results Orientation Self', 'Results Orientation Mgr', 'Results Orientation Comments', 'Results Orientation Mid-Year Self', 'Results Orientation Mid-Year Mgr',
      'Ownership Self', 'Ownership Mgr', 'Ownership Comments', 'Ownership Mid-Year Self', 'Ownership Mid-Year Mgr',
      'IDP Development Goal', 'IDP Staff Goals', 'IDP Assessor Roadmap', 'IDP Mid-Year Staff Goals', 'IDP Mid-Year Assessor Roadmap',
      'Staff Final Summary', 'Final Official Rating', 'Manager Executive Narrative', 'Mid-Year Staff Summary', 'Mid-Year Manager Narrative',
      'Submitted At', 'Reviewed At'
    ];

    const rows = completed.map(a => {
      const rowData: any[] = [
        a.employeeDetails.fullName,
        a.employeeDetails.email,
        a.employeeDetails.position,
        a.employeeDetails.division,
        a.managerName,
        a.managerEmail,
        a.reviewType === 'mid-year' ? 'Mid-Year Review' : 'Final Year Review',
        a.status,
        a.midYearStatus || ''
      ];

      const kpis = a.kpis || [];
      for (let i = 0; i < 5; i++) {
        const k = kpis[i];
        if (k) {
          rowData.push(
            k.title, k.description || '',
            fmtRating(k.selfRating), k.selfComments || '',
            fmtRating(k.managerRating), k.managerComments || '',
            k.midYearSelfComments || '', k.midYearManagerComments || ''
          );
        } else {
          rowData.push('', '', '', '', '', '', '', '');
        }
      }

      // Competency order mirrors the fixed header list; pad with blanks if
      // a legacy record has fewer entries.
      const comps = a.coreCompetencies || [];
      for (let i = 0; i < 6; i++) {
        const c = comps[i];
        if (c) {
          rowData.push(
            fmtRating(c.selfRating), fmtRating(c.managerRating), c.managerComments || '',
            c.midYearSelfComments || '', c.midYearManagerComments || ''
          );
        } else {
          rowData.push('', '', '', '', '');
        }
      }

      rowData.push(
        a.developmentPlan?.developmentGoal || '',
        a.developmentPlan?.selfComments || '',
        a.developmentPlan?.managerComments || '',
        a.developmentPlan?.midYearSelfComments || '',
        a.developmentPlan?.midYearManagerComments || ''
      );

      rowData.push(
        a.overallPerformance?.selfComments || '',
        fmtRating(a.overallPerformance?.managerRating),
        a.overallPerformance?.managerComments || '',
        a.overallPerformance?.midYearSelfComments || '',
        a.overallPerformance?.midYearManagerComments || ''
      );

      rowData.push(a.submittedAt || a.midYearSubmittedAt || 'N/A', a.reviewedAt || 'N/A');

      return rowData.map(val => {
        let str = String(val === undefined || val === null ? '' : val);
        // Guard against CSV/Excel formula injection (=, +, -, @ prefixes)
        str = str.replace(/^([=+\-@\t\r])/, "'$1");
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

  const handleDownloadPDF = async (name: string, type: string) => {
    const element = document.getElementById('appraisal-report');
    if (!element) return;
    setIsDownloading(true);
    
    try {
      // Loaded on demand so the large PDF library stays out of the main bundle
      const { default: html2pdf } = await import('html2pdf.js');
      const opt = {
        margin: 10,
        filename: `Appraisal_${name.replace(/\s+/g, '_')}_${type}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Sorry, the PDF could not be generated. Please try again.');
    } finally {
      setIsDownloading(false);
    }
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
              <button onClick={() => handleDownloadPDF(selectedAssessment.employeeDetails.fullName, selectedAssessment.reviewType)} disabled={isDownloading} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50">
                {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
              </button>
            )}
          </div>
        </div>
        <AppraisalReport 
          assessment={selectedAssessment} 
          isEditable={!isReviewed} 
          isDownloading={isDownloading} 
          onUpdate={(upd, immediate) => {
            setSelectedAssessment(upd);
            onUpdate(upd, immediate);
          }} 
          onFinalize={(final) => { onReviewComplete(final); setSelectedAssessment(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
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
          {EXPENSES_ENABLED ? (
            <button onClick={() => setActiveTab('expenses')} className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'expenses' ? 'text-brand-600' : 'text-slate-400'}`}>
              {expenseTabLabel}
              {activeTab === 'expenses' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600"></div>}
            </button>
          ) : (
            <button disabled title="Expense Claims - coming soon" className="pb-4 px-2 text-sm font-bold text-slate-300 cursor-not-allowed flex items-center gap-2">
              Expenses
              <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 border border-slate-200">Soon</span>
            </button>
          )}
          {role === 'manager' && EXPENSES_ENABLED && (
            <button onClick={() => setActiveTab('my-expenses')} className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'my-expenses' ? 'text-brand-600' : 'text-slate-400'}`}>
              My Expenses
              {activeTab === 'my-expenses' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600"></div>}
            </button>
          )}
          {role === 'manager' && EXPENSES_ENABLED && isGm && (
            <button onClick={() => setActiveTab('gm-approvals')} className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'gm-approvals' ? 'text-brand-600' : gmPendingCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              GM Approvals ({gmPendingCount})
              {gmPendingCount > 0 && activeTab !== 'gm-approvals' && (
                <span className="absolute top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              )}
              {activeTab === 'gm-approvals' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600"></div>}
            </button>
          )}
          {role === 'manager' && EXPENSES_ENABLED && (
            <button onClick={() => setActiveTab('dashboard')} className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'dashboard' ? 'text-brand-600' : 'text-slate-400'}`}>
              Dashboard
              {activeTab === 'dashboard' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600"></div>}
            </button>
          )}
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

      {activeTab === 'expenses' ? (
        EXPENSES_ENABLED ? (
          role === 'manager' ? (
            <ManagerExpenses
              claims={expenseClaims}
              isLoading={expenseLoading}
              error={expenseError}
              currentUserEmail={currentUserEmail}
              onRefresh={loadExpenseClaims}
            />
          ) : (
            <AdminExpenses
              claims={expenseClaims}
              isLoading={expenseLoading}
              error={expenseError}
              currentUserEmail={currentUserEmail}
              onRefresh={loadExpenseClaims}
            />
          )
        ) : (
          <div className="bg-white rounded-3xl border p-12 text-center">
            <p className="text-sm font-bold text-slate-400">Expense Claims are coming soon.</p>
            <p className="text-xs text-slate-300 mt-1">This module is being finalised and will open to staff shortly.</p>
          </div>
        )
      ) : activeTab === 'my-expenses' ? (
        <ExpenseClaims
          staffName={expenseProfile?.staffName || currentUserEmail}
          staffEmail={currentUserEmail}
          managerEmail={expenseProfile?.managerEmail || ''}
          managerName={expenseProfile?.managerName}
        />
      ) : activeTab === 'gm-approvals' ? (
        <GmExpenses
          claims={expenseClaims}
          isLoading={expenseLoading}
          error={expenseError}
          currentUserEmail={currentUserEmail}
          onRefresh={loadExpenseClaims}
        />
      ) : activeTab === 'dashboard' ? (
        <ExpenseDashboard currentUserEmail={currentUserEmail} />
      ) : (
      <div className="bg-white rounded-3xl shadow-xl border overflow-hidden no-print">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Member</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manager</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Score</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(activeTab === 'submissions' 
              ? filteredAssessments.filter(a => a.status === 'submitted' || a.status === 'reviewed') 
              : filteredAssessments
            ).map(a => {
              const getStatusDisplay = () => {
                if (a.status === 'reviewed') return { text: 'Completed', classes: 'bg-green-50 text-green-700 border-green-200' };
                if (a.status === 'submitted') {
                  const isMidYear = a.reviewType === 'mid-year';
                  return { 
                    text: isMidYear ? 'Mid-Year Submitted' : 'Final Submitted', 
                    classes: isMidYear ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-brand-50 text-brand-700 border-brand-200' 
                  };
                }
                return { text: 'Draft', classes: 'bg-slate-50 text-slate-400 border-slate-200' };
              };
              const status = getStatusDisplay();

              return (
                <tr key={a.id} className="hover:bg-slate-50 group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <p className="text-sm font-bold text-slate-800">{a.employeeDetails.fullName}</p>
                      <p className={`text-[10px] font-black uppercase tracking-tight ${a.reviewType === 'mid-year' ? 'text-brand-600' : 'text-blue-600'}`}>
                        {a.reviewType === 'mid-year' ? 'Mid-Year' : 'Final Year'}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-400">{a.employeeDetails.email}</p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-medium text-slate-600">{a.managerName}</p>
                    <p className="text-[11px] text-slate-400">{a.managerEmail}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${status.classes}`}>
                      {status.text}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    {a.reviewType === 'final' && a.overallPerformance.managerRating ? (
                      <span className="text-sm font-black text-slate-800">
                        {a.overallPerformance.managerRating.split(' - ')[0]}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">N/A</span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                     <div className="flex justify-end gap-3">
                      <button onClick={() => setSelectedAssessment(a)} className="text-xs font-black text-brand-600 uppercase tracking-widest hover:underline">
                        {a.status === 'submitted' ? 'Review & Rate' : a.status === 'reviewed' ? 'View Report' : 'View Details'}
                      </button>
                      {role === 'admin' && (
                        <button onClick={() => onDeleteAssessment(a.id)} className="text-xs font-black text-red-400 uppercase tracking-widest hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          Delete
                        </button>
                      )}
                     </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};

export default AdminDashboard;
