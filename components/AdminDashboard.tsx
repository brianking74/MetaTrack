
import React, { useState, useRef } from 'react';
import { Assessment, Rating, KPI, RoleType, Competency } from '../types.ts';
import { createBlankAssessment } from '../constants.ts';

interface AdminDashboardProps {
  assessments: Assessment[];
  currentUserEmail: string;
  role: RoleType;
  onReviewComplete: (updated: Assessment) => void;
  onBulkUpload: (newAssessments: Assessment[]) => void;
  onDeleteAssessment: (id: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  assessments, 
  currentUserEmail, 
  role, 
  onReviewComplete,
  onBulkUpload,
  onDeleteAssessment
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
          if (row.length < 9) return;
          // Extract 10th column if it exists for password
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

  const handleEmailReport = (assessment: Assessment) => {
    const subject = encodeURIComponent(`Final Performance Appraisal Report: ${assessment.employeeDetails.fullName}`);
    const body = encodeURIComponent(
      `Hi ${assessment.employeeDetails.fullName},\n\n` +
      `Your performance appraisal has been reviewed and finalized.\n\n` +
      `Final Grade: ${assessment.overallPerformance.managerRating}\n\n` +
      `Summary: ${assessment.overallPerformance.managerComments}\n\n` +
      `You can now access your detailed feedback and development roadmap on the MetaBev Staff Portal.\n\n` +
      `Regards,\n` +
      `${assessment.managerName}`
    );
    window.location.href = `mailto:${assessment.employeeDetails.email}?subject=${subject}&body=${body}`;
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

  const renderRatingSelect = (currentRating: Rating | undefined, onChange: (r: Rating) => void, isDisabled: boolean = false) => (
    <select 
      value={currentRating || ''} 
      onChange={(e) => onChange(e.target.value as Rating)}
      disabled={isDisabled}
      className={`w-full max-w-xs border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none ${isDisabled ? 'bg-slate-100 text-slate-500' : 'bg-white'}`}
    >
      <option value="" disabled>Select Rating</option>
      {Object.values(Rating).map(r => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );

  const SectionTitle = ({ children, colorClass = "border-brand-600" }: { children?: React.ReactNode, colorClass?: string }) => (
    <h4 className={`text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-8 border-l-4 ${colorClass} pl-4`}>
      {children}
    </h4>
  );

  if (selectedAssessment) {
    const isReviewed = selectedAssessment.status === 'reviewed';
    return (
      <div className="space-y-8 animate-in fade-in duration-300 pb-20">
        <div className="flex justify-between items-center no-print">
          <button onClick={() => setSelectedAssessment(null)} className="text-sm font-bold text-brand-600 hover:underline flex items-center gap-1">
            &larr; Back to Dashboard
          </button>
          
          {isReviewed && (
            <div className="flex gap-3">
              <button 
                onClick={() => handleEmailReport(selectedAssessment)}
                className="px-6 py-2 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg text-xs font-bold hover:bg-brand-100 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Email to Staff
              </button>
              <button 
                onClick={() => handleDownloadPDF(selectedAssessment.employeeDetails.fullName)} 
                disabled={isDownloading}
                className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
              </button>
            </div>
          )}
        </div>
        
        <div id="appraisal-report" className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
          <div className="border-b pb-8 mb-12 flex justify-between items-start">
            <div>
              <h3 className="text-4xl font-black text-slate-900 leading-tight">{selectedAssessment.employeeDetails.fullName}</h3>
              <p className="text-sm font-medium text-brand-600">{selectedAssessment.employeeDetails.email}</p>
              <div className="mt-4 flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Manager: {selectedAssessment.managerName}</span>
                <span className="opacity-40">|</span>
                <span>Role: Staff Member</span>
              </div>
            </div>
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isReviewed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'} no-print`}>
              {selectedAssessment.status}
            </span>
          </div>

          <div className="space-y-24">
            {/* 1. KPIs SECTION */}
            <section>
              <SectionTitle>Key Performance Indicators</SectionTitle>
              <div className="space-y-16">
                {selectedAssessment.kpis.map((kpi, idx) => (
                  <div key={kpi.id} className="p-8 md:p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100 print:bg-white print:border-slate-200">
                    <div className="flex justify-between mb-6">
                      <h5 className="text-2xl font-black text-slate-900">{kpi.title}</h5>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Performance Goal</span>
                    </div>
                    
                    <div className="mb-10">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 opacity-60">KPI Description / Expectations</span>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 text-sm text-slate-700 leading-relaxed italic shadow-inner">
                        {kpi.description}
                      </div>
                    </div>

                    <div className="space-y-10">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 border-b pb-2">Annual Self-Appraisal</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-2">
                           <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-black uppercase rounded tracking-widest">Staff Rating</span>
                           <div className="p-3 bg-white border border-brand-100 rounded-xl text-sm font-bold text-slate-700 shadow-sm">{kpi.selfRating || 'Pending'}</div>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                           <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-black uppercase rounded tracking-widest">Achievement Comments</span>
                           <div className="p-4 bg-white border border-brand-100 rounded-xl text-xs text-slate-600 italic leading-relaxed min-h-[100px] shadow-sm">
                              "{kpi.selfComments || 'No staff comments provided.'}"
                           </div>
                        </div>
                      </div>

                      {/* ASSESSOR FEEDBACK AREA - RESTORED & PROMINENT */}
                      <div className="pt-10 mt-10 border-t-2 border-slate-200 space-y-8 bg-white p-8 rounded-[2rem] border-2 shadow-lg border-slate-200 print:shadow-none print:border-slate-200">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-3 h-3 rounded-full bg-slate-900"></div>
                          <h6 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.4em]">Official Assessor Feedback Loop</h6>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="space-y-4">
                            <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded tracking-widest">Assessor Rating</span>
                            {isReviewed ? (
                               <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800">{kpi.managerRating}</div>
                            ) : (
                               renderRatingSelect(kpi.managerRating, (r) => {
                                 const upd = {...selectedAssessment, kpis: selectedAssessment.kpis.map(k => k.id === kpi.id ? {...k, managerRating: r} : k)};
                                 setSelectedAssessment(upd);
                               }, isReviewed)
                            )}
                          </div>
                          <div className="md:col-span-2 space-y-4">
                            <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded tracking-widest">Assessor Review Comments</span>
                            {isReviewed ? (
                               <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 min-h-[144px] leading-relaxed italic">{kpi.managerComments}</div>
                            ) : (
                               <textarea 
                                 value={kpi.managerComments || ''}
                                 readOnly={isReviewed}
                                 onChange={(e) => {
                                   const upd = {...selectedAssessment, kpis: selectedAssessment.kpis.map(k => k.id === kpi.id ? {...k, managerComments: e.target.value} : k)};
                                   setSelectedAssessment(upd);
                                 }}
                                 className="w-full text-xs border border-slate-300 rounded-2xl p-5 h-36 outline-none focus:ring-2 focus:ring-brand-500 shadow-inner bg-slate-50/50"
                                 placeholder="Evaluate staff performance against this goal for the cycle..."
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

            {/* 2. CORE COMPETENCIES SECTION */}
            <section>
              <SectionTitle colorClass="border-slate-400">Core Competencies</SectionTitle>
              <div className="space-y-12">
                {selectedAssessment.coreCompetencies.map((comp, idx) => (
                  <div key={comp.id} className="p-8 md:p-10 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8 print:shadow-none">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1 pr-8">
                         <h5 className="text-xl font-black text-slate-900">{idx + 1}. {comp.name}</h5>
                         <p className="text-xs text-slate-500 mt-2 leading-relaxed">{comp.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-black uppercase rounded tracking-widest block mb-1">Staff Self-Rating</span>
                        <span className="text-sm font-bold text-slate-800">{comp.selfRating || 'N/A'}</span>
                      </div>
                    </div>

                    {/* ASSESSOR FEEDBACK FOR COMPETENCIES */}
                    <div className="pt-10 border-t border-slate-200 bg-slate-50/50 p-8 rounded-3xl space-y-8">
                       <h6 className="text-[9px] font-black text-slate-900 uppercase tracking-widest opacity-60">Assessor Behavioral Evaluation</h6>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                          <div className="space-y-2">
                             <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded tracking-widest block mb-3">Official Competency Grade</span>
                             {isReviewed ? (
                                <div className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800">{comp.managerRating}</div>
                             ) : (
                                renderRatingSelect(comp.managerRating, (r) => {
                                  const upd = {...selectedAssessment, coreCompetencies: selectedAssessment.coreCompetencies.map(c => c.id === comp.id ? {...c, managerRating: r} : c)};
                                  setSelectedAssessment(upd);
                                }, isReviewed)
                             )}
                          </div>
                          <div className="md:col-span-2 space-y-2">
                             <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded tracking-widest block mb-3">Evidence-Based Assessment</span>
                             {isReviewed ? (
                                <div className="p-4 bg-white border border-slate-200 rounded-2xl text-xs text-slate-700 min-h-[112px] leading-relaxed">{comp.managerComments}</div>
                             ) : (
                                <textarea 
                                  value={comp.managerComments || ''}
                                  readOnly={isReviewed}
                                  onChange={(e) => {
                                    const upd = {...selectedAssessment, coreCompetencies: selectedAssessment.coreCompetencies.map(c => c.id === comp.id ? {...c, managerComments: e.target.value} : c)};
                                    setSelectedAssessment(upd);
                                  }}
                                  className="w-full text-xs border border-slate-300 rounded-2xl p-4 h-28 outline-none focus:ring-2 focus:ring-brand-500 shadow-inner bg-white"
                                  placeholder="Comment on behavioral indicators for this competency..."
                                />
                             )}
                             <p className="text-[9px] text-slate-400 italic mt-2">Indicators: {comp.indicators.join(', ')}</p>
                          </div>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. DEVELOPMENT PLAN SECTION */}
            <section className="bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl text-white print:bg-slate-100 print:text-slate-900 print:shadow-none">
               <SectionTitle colorClass="border-brand-500">Individual Development Plan</SectionTitle>
               <div className="space-y-10">
                  <div className="space-y-3">
                    <span className="px-2 py-0.5 bg-brand-600 text-white text-[9px] font-black uppercase rounded tracking-widest">Staff Development Goals</span>
                    <div className="p-6 bg-slate-800 rounded-2xl text-xs text-slate-300 italic leading-relaxed min-h-[120px] print:bg-white print:text-slate-600 print:border">
                      "{selectedAssessment.developmentPlan.selfComments || 'No self-reflection provided.'}"
                    </div>
                  </div>
                  <div className="space-y-3">
                    <span className="px-2 py-0.5 bg-white text-slate-900 text-[9px] font-black uppercase rounded tracking-widest border border-slate-200 print:bg-slate-900 print:text-white">Assessor Developmental Roadmap</span>
                    {isReviewed ? (
                       <div className="p-6 bg-slate-800 rounded-2xl text-sm text-white print:bg-white print:text-slate-800 print:border min-h-[160px]">{selectedAssessment.developmentPlan.managerComments}</div>
                    ) : (
                       <textarea 
                         value={selectedAssessment.developmentPlan.managerComments || ''}
                         readOnly={isReviewed}
                         onChange={(e) => setSelectedAssessment({...selectedAssessment, developmentPlan: {...selectedAssessment.developmentPlan, managerComments: e.target.value}})}
                         className="w-full text-xs bg-slate-800 text-white border-none rounded-2xl p-6 h-40 outline-none focus:ring-2 focus:ring-brand-500 shadow-inner"
                         placeholder="Outline specific training needs or future growth expectations..."
                       />
                    )}
                  </div>
               </div>
            </section>

            {/* 4. FINAL EXECUTIVE SUMMARY SECTION */}
            <section className="pt-12 border-t-2 border-slate-100">
              <SectionTitle>Executive Summary & Final Grade</SectionTitle>
              <div className="space-y-12">
                <div className="space-y-3">
                  <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-black uppercase rounded tracking-widest">Staff Final Summary</span>
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border text-sm text-slate-600 italic leading-relaxed shadow-inner">
                    "{selectedAssessment.overallPerformance.selfComments || 'No overall summary provided.'}"
                  </div>
                </div>

                {!isReviewed ? (
                  <div className="bg-brand-50 p-10 rounded-[3rem] border-2 border-brand-100 flex flex-col gap-10">
                    <div className="space-y-4">
                      <label className="text-brand-900 text-[10px] font-black uppercase tracking-[0.3em] px-2 block">Manager Final Performance Appraisal Narrative</label>
                      <textarea 
                        value={selectedAssessment.overallPerformance.managerComments || ''}
                        onChange={(e) => setSelectedAssessment({...selectedAssessment, overallPerformance: {...selectedAssessment.overallPerformance, managerComments: e.target.value}})}
                        className="w-full bg-white text-slate-800 p-8 rounded-[2rem] border-slate-200 outline-none text-sm h-56 focus:ring-2 focus:ring-brand-500 shadow-lg"
                        placeholder="Provide the final executive evaluation for this annual review cycle..."
                      />
                    </div>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-6 border-t border-brand-200">
                      <div className="flex-1 w-full max-w-md">
                        <label className="text-brand-900 text-[10px] font-black uppercase tracking-widest block mb-3">Final Official Performance Grade</label>
                        <select 
                          value={selectedAssessment.overallPerformance.managerRating || ''}
                          onChange={(e) => setSelectedAssessment({...selectedAssessment, overallPerformance: {...selectedAssessment.overallPerformance, managerRating: e.target.value as Rating}})}
                          className="w-full bg-white text-slate-900 p-4 rounded-xl border border-brand-300 outline-none text-sm font-bold shadow-sm"
                        >
                          <option value="">Select Official Result...</option>
                          {Object.values(Rating).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <button 
                        onClick={() => {
                          if(!selectedAssessment.overallPerformance.managerRating) return alert("Final grade is required.");
                          onReviewComplete({...selectedAssessment, status: 'reviewed'});
                          setSelectedAssessment(null);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }} 
                        className="bg-brand-600 text-white px-14 py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] hover:bg-brand-700 transition-all shadow-2xl transform active:scale-95"
                      >
                        Finalize Review Cycle
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 bg-slate-900 text-white rounded-[3rem] flex flex-col md:flex-row justify-between items-center gap-10 shadow-2xl print:bg-slate-50 print:text-slate-900 print:shadow-none print:border">
                     <div className="space-y-2">
                        <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest block">Final Result</span>
                        <span className="text-5xl font-black text-white print:text-brand-900">{selectedAssessment.overallPerformance.managerRating}</span>
                     </div>
                     <div className="md:max-w-lg text-right border-l border-slate-700 pl-10 print:border-slate-300">
                        <p className="text-sm text-slate-400 italic font-medium leading-relaxed print:text-slate-600">
                          {selectedAssessment.overallPerformance.managerComments}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-40">Review Concluded & Archived</p>
                     </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
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
          <div className="flex gap-3">
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
            {((activeTab === 'submissions' && submissionsCount === 0) || (activeTab === 'management' && registryCount === 0)) && (
              <tr>
                <td colSpan={4} className="px-8 py-20 text-center text-slate-400 text-sm italic">
                  {activeTab === 'submissions' ? 'Awaiting staff self-appraisals...' : 'No staff members registered yet. Upload a CSV to begin.'}
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
