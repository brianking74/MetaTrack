
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import AssessmentForm from './components/AssessmentForm.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import { Assessment, RoleType, Rating } from './types.ts';
import confetti from 'canvas-confetti';

const MASTER_ADMIN_PASSWORD = "metabevadmin"; 
const SUPER_ADMIN_EMAIL = "admin@metabev.com";

const App: React.FC = () => {
  const [role, setRole] = useState<RoleType | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [showFullReport, setShowFullReport] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [staffEmailInput, setStaffEmailInput] = useState("");
  const [assessorEmailInput, setAssessorEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem('metabev-assessments-v2');
    if (saved) {
      try { setAssessments(JSON.parse(saved)); } catch (e) { localStorage.removeItem('metabev-assessments-v2'); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('metabev-assessments-v2', JSON.stringify(assessments));
  }, [assessments]);

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = staffEmailInput.trim().toLowerCase();
    if (!email.includes("@")) { setAuthError("Please enter a valid email."); return; }
    setCurrentUserEmail(email);
    setRole('staff');
    setAuthError("");
    setShowFullReport(false);
  };

  const handleAssessorLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = assessorEmailInput.trim().toLowerCase();
    
    // 1. Check for Super Admin (Backdoor)
    if (email === SUPER_ADMIN_EMAIL && passwordInput === MASTER_ADMIN_PASSWORD) {
      setCurrentUserEmail(email);
      setRole('admin');
      setAuthError("");
      return;
    }

    // 2. Check for Individual Manager in Registry
    const validManagerRecord = assessments.find(a => 
      a.managerEmail.toLowerCase() === email && 
      (a.managerPassword === passwordInput || (!a.managerPassword && passwordInput === 'metabev2025'))
    );

    if (validManagerRecord) {
      setCurrentUserEmail(email);
      setRole('manager');
      setAuthError("");
    } else {
      setAuthError("Invalid manager email or password. Please check the registry.");
    }
  };

  const handleLogout = () => {
    setRole(null);
    setCurrentUserEmail("");
    setStaffEmailInput("");
    setAssessorEmailInput("");
    setPasswordInput("");
    setAuthError("");
  };

  const handleEmailReport = (assessment: Assessment) => {
    const subject = encodeURIComponent(`Performance Appraisal Report: ${assessment.employeeDetails.fullName}`);
    const body = encodeURIComponent(
      `Hi ${assessment.employeeDetails.fullName},\n\n` +
      `Your performance appraisal for the current cycle has been finalized.\n\n` +
      `Final Grade: ${assessment.overallPerformance.managerRating}\n` +
      `Manager Comments: ${assessment.overallPerformance.managerComments}\n\n` +
      `You can view the full report on the MetaBev Staff Portal.\n\n` +
      `Best Regards,\n` +
      `MetaBev HR`
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

  const currentAssessment = assessments.find(a => a.employeeDetails.email.toLowerCase() === currentUserEmail.toLowerCase());

  const handleSubmitAssessment = (data: Assessment) => {
    const submitted = { ...data, status: 'submitted' as const, submittedAt: new Date().toISOString() };
    setAssessments(prev => prev.map(a => a.id === data.id ? submitted : a));
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#c87a41', '#5c3b25', '#ffffff'] });
  };

  const handleBulkUpload = (newEntries: Assessment[]) => {
    setAssessments(prev => {
      const merged = [...prev];
      newEntries.forEach(entry => {
        const email = entry.employeeDetails.email.toLowerCase();
        const idx = merged.findIndex(m => m.employeeDetails.email.toLowerCase() === email);
        if (idx === -1) merged.push(entry);
        else merged[idx] = { 
          ...merged[idx], 
          kpis: entry.kpis, 
          managerName: entry.managerName, 
          managerEmail: entry.managerEmail,
          managerPassword: entry.managerPassword 
        };
      });
      return merged;
    });
  };

  const renderFullReport = (assessment: Assessment) => (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-8 no-print">
         <button onClick={() => setShowFullReport(false)} className="text-sm font-bold text-brand-600 hover:underline flex items-center gap-1">
           &larr; Back to Summary
         </button>
         <div className="flex gap-3">
           <button 
             onClick={() => handleEmailReport(assessment)}
             className="px-6 py-2 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg text-xs font-bold hover:bg-brand-100 transition-colors flex items-center gap-2"
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
             Email Copy
           </button>
           <button 
             onClick={() => handleDownloadPDF(assessment.employeeDetails.fullName)} 
             disabled={isDownloading}
             className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
             {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
           </button>
         </div>
      </div>

      <div id="appraisal-report" className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-xl print:shadow-none print:border-none print:p-0">
        <div className="border-b pb-10 mb-12 flex justify-between items-start">
          <div>
            <h2 className="text-4xl font-black text-slate-900 leading-tight">{assessment.employeeDetails.fullName}</h2>
            <p className="text-brand-600 font-medium">{assessment.employeeDetails.email}</p>
            <div className="mt-4 flex gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Position: {assessment.employeeDetails.position}</span>
              <span>Division: {assessment.employeeDetails.division}</span>
            </div>
          </div>
          <div className="text-right">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-2">Cycle Result</span>
             <span className="text-5xl font-black text-brand-900">{assessment.overallPerformance.managerRating}</span>
          </div>
        </div>

        {/* KPIs */}
        <section className="space-y-12">
           <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mb-8 border-l-4 border-brand-600 pl-4">Key Performance Indicators</h4>
           {assessment.kpis.map((kpi, idx) => (
             <div key={kpi.id} className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-8 print:bg-white print:border-slate-200">
               <div className="flex justify-between">
                 <h5 className="text-xl font-black text-slate-800">{kpi.title}</h5>
                 <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">{kpi.managerRating}</span>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">My Input</span>
                    <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs italic text-slate-600 min-h-[80px]">"{kpi.selfComments}"</div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-brand-600 uppercase tracking-widest">Manager Response</span>
                    <div className="p-4 bg-white rounded-xl border border-brand-100 text-xs text-slate-800 leading-relaxed min-h-[80px]">{kpi.managerComments}</div>
                  </div>
               </div>
             </div>
           ))}
        </section>

        {/* Development */}
        <section className="mt-20">
           <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mb-8 border-l-4 border-slate-400 pl-4">Individual Development Roadmap</h4>
           <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] space-y-8 print:bg-slate-100 print:text-slate-900">
              <div className="space-y-2">
                <span className="text-[9px] font-black text-brand-400 uppercase tracking-widest print:text-brand-700">Manager Developmental Advice</span>
                <p className="text-sm leading-relaxed text-slate-200 print:text-slate-700">{assessment.developmentPlan.managerComments || 'No comments provided'}</p>
              </div>
           </div>
        </section>

        {/* Executive Summary */}
        <section className="mt-20 pt-12 border-t border-slate-100">
           <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mb-8">Executive Assessment Summary</h4>
           <div className="bg-brand-50 p-10 rounded-[2.5rem] border-2 border-brand-100 space-y-6 print:bg-white print:border-slate-200">
              <span className="text-[9px] font-black text-brand-900 uppercase tracking-widest block">Overall Manager Evaluation</span>
              <p className="text-sm leading-relaxed text-slate-800 font-medium">{assessment.overallPerformance.managerComments}</p>
           </div>
        </section>
      </div>
    </div>
  );

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
          <div className="bg-brand-900 md:w-1/2 p-12 flex flex-col justify-between text-white">
            <div>
              <h1 className="text-4xl font-serif tracking-widest mb-2" style={{ fontFamily: 'Georgia, serif' }}>METABEV</h1>
              <p className="text-xs uppercase tracking-[0.4em] opacity-60">Staff Performance Portal</p>
            </div>
            <p className="text-sm opacity-80 leading-relaxed italic">"Excellence is not a singular act, but a habit."</p>
          </div>
          <div className="md:w-1/2 p-12 bg-white">
            <h2 className="text-2xl font-black text-slate-800 mb-8">Login to Portal</h2>
            <div className="space-y-10">
              <form onSubmit={handleStaffLogin} className="space-y-4" autoComplete="off">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">For Employees</span>
                <input name="staff_user_email" type="email" placeholder="Staff Email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" value={staffEmailInput} onChange={(e) => setStaffEmailInput(e.target.value)} required />
                <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg">Staff Access</button>
              </form>
              <div className="relative py-2 text-center"><span className="bg-white px-3 text-[10px] font-black text-slate-300 uppercase">OR</span></div>
              <form onSubmit={handleAssessorLogin} className="space-y-4" autoComplete="off">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">For Managers</span>
                <input name="manager_user_email" type="email" placeholder="Manager Email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" value={assessorEmailInput} onChange={(e) => setAssessorEmailInput(e.target.value)} required />
                <input name="manager_user_password" type="password" placeholder="Assessor Password" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required />
                <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold shadow-lg">Assessor Hub</button>
              </form>
              {authError && <p className="text-center text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg">{authError}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout title={role === 'staff' ? 'My Performance Review' : 'Assessor Review Hub'} role={role === 'staff' ? 'employee' : 'admin'} onRoleSwitch={handleLogout}>
      <div className="max-w-7xl mx-auto">
        {role === 'staff' ? (
          currentAssessment ? (
            currentAssessment.status === 'reviewed' ? (
              showFullReport ? renderFullReport(currentAssessment) : (
                <div className="bg-white p-16 rounded-[2.5rem] shadow-2xl text-center border border-slate-100 max-w-2xl mx-auto animate-in fade-in zoom-in duration-500">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h2 className="text-4xl font-black mb-4 text-slate-900">Review Complete</h2>
                  <p className="text-slate-500 mb-10 leading-relaxed">Your manager has finalized your annual appraisal. Your performance rating for this cycle is displayed below.</p>
                  <div className="p-10 bg-brand-50 border-2 border-brand-100 rounded-[2rem] inline-block shadow-inner mb-10">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-3">Official Performance Grade</span>
                    <span className="text-4xl font-black text-brand-900">{currentAssessment.overallPerformance.managerRating || "Final Rating Pending"}</span>
                  </div>
                  <button onClick={() => setShowFullReport(true)} className="block w-full text-brand-600 font-black text-xs uppercase tracking-widest hover:underline">View Detailed Appraisal Feedback &rarr;</button>
                </div>
              )
            ) : currentAssessment.status === 'submitted' ? (
              <div className="bg-white p-16 rounded-[2.5rem] shadow-2xl text-center border border-slate-100 max-w-2xl mx-auto animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-8">
                   <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-4xl font-black mb-4 text-slate-900">Thank You!</h2>
                <p className="text-slate-500 mb-8 leading-relaxed">Your performance appraisal has been successfully submitted to <b>{currentAssessment.managerName}</b> for review.</p>
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] pt-8 border-t">Status: Awaiting Manager Assessment</div>
              </div>
            ) : (
              <AssessmentForm initialData={currentAssessment} onSave={(d) => setAssessments(prev => prev.map(a => a.id === d.id ? d : a))} onSubmit={handleSubmitAssessment} />
            )
          ) : (
            <div className="bg-white p-12 rounded-3xl shadow-xl text-center">
              <h2 className="text-2xl font-black text-slate-800 mb-4">Registry Entry Not Found</h2>
              <p className="text-slate-500 max-w-lg mx-auto">The email <b>{currentUserEmail}</b> is not in the registry. Please contact your manager.</p>
              <button onClick={handleLogout} className="mt-8 text-brand-600 font-bold hover:underline">Sign Out & Try Another</button>
            </div>
          )
        ) : (
          <AdminDashboard assessments={assessments} currentUserEmail={currentUserEmail} role={role} onReviewComplete={(upd) => setAssessments(prev => prev.map(a => a.id === upd.id ? upd : a))} onBulkUpload={handleBulkUpload} onDeleteAssessment={(id) => setAssessments(prev => prev.filter(a => a.id !== id))} />
        )}
      </div>
    </Layout>
  );
};

export default App;
