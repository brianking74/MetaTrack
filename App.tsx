
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import AssessmentForm from './components/AssessmentForm.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import { Assessment, RoleType } from './types.ts';
import { supabaseService } from './services/supabase.ts';
import confetti from 'canvas-confetti';

const MASTER_ADMIN_PASSWORD = "metabevadmin"; 
const SUPER_ADMIN_EMAIL = "admin@metabev.com";

const App: React.FC = () => {
  const [role, setRole] = useState<RoleType | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [showFullReport, setShowFullReport] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [staffEmailInput, setStaffEmailInput] = useState("");
  const [assessorEmailInput, setAssessorEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Initialize: Load from cloud instead of localStorage
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await supabaseService.getAllAssessments();
      // Fallback to localStorage if cloud is not yet configured or fails
      if (data.length === 0) {
        const saved = localStorage.getItem('metabev-assessments-v2');
        if (saved) {
          try { setAssessments(JSON.parse(saved)); } catch (e) {}
        }
      } else {
        setAssessments(data);
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Background backup to localStorage just in case
  useEffect(() => {
    if (assessments.length > 0) {
      localStorage.setItem('metabev-assessments-v2', JSON.stringify(assessments));
    }
  }, [assessments]);

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = staffEmailInput.trim().toLowerCase();
    if (!email.includes("@")) { setAuthError("Please enter a valid email."); return; }
    
    // Check registry in state (which is synced from cloud)
    const exists = assessments.some(a => a.employeeDetails.email.toLowerCase() === email);
    if (!exists && email !== SUPER_ADMIN_EMAIL) {
      setAuthError("This email is not registered in the portal. Please contact HR.");
      return;
    }

    setCurrentUserEmail(email);
    setRole('staff');
    setAuthError("");
    setShowFullReport(false);
  };

  const handleAssessorLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = assessorEmailInput.trim().toLowerCase();
    
    if (email === SUPER_ADMIN_EMAIL && passwordInput === MASTER_ADMIN_PASSWORD) {
      setCurrentUserEmail(email);
      setRole('admin');
      setAuthError("");
      return;
    }

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

  const syncToCloud = async (updatedAssessments: Assessment[]) => {
    setIsSyncing(true);
    // Ideally we only sync the changed one, but for simplicity we bulk update
    await supabaseService.bulkSaveAssessments(updatedAssessments);
    setIsSyncing(false);
  };

  const handleSaveAssessment = async (data: Assessment) => {
    const next = assessments.map(a => a.id === data.id ? data : a);
    setAssessments(next);
    await syncToCloud(next);
  };

  const handleSubmitAssessment = async (data: Assessment) => {
    const submitted = { ...data, status: 'submitted' as const, submittedAt: new Date().toISOString() };
    const next = assessments.map(a => a.id === data.id ? submitted : a);
    setAssessments(next);
    await syncToCloud(next);
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#c87a41', '#5c3b25', '#ffffff'] });
  };

  const handleBulkUpload = async (newEntries: Assessment[]) => {
    const merged = [...assessments];
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
    setAssessments(merged);
    await syncToCloud(merged);
  };

  const onDeleteAssessment = async (id: string) => {
    const next = assessments.filter(a => a.id !== id);
    setAssessments(next);
    await supabaseService.deleteAssessment(id);
  };

  const currentAssessment = assessments.find(a => a.employeeDetails.email.toLowerCase() === currentUserEmail.toLowerCase());

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-black uppercase tracking-[0.4em] opacity-60">Connecting to Cloud Registry...</p>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
          {/* Left Side: Brand Panel with Texture Overlay */}
          <div className="bg-brand-900 md:w-1/2 p-12 flex flex-col justify-between text-white relative overflow-hidden">
            {/* Texture Layer */}
            <div 
              className="absolute inset-0 z-0 opacity-20 pointer-events-none bg-cover bg-center mix-blend-overlay"
              style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1550537687-c91072c4792d?q=80&w=1000&auto=format&fit=crop")' }}
            ></div>
            
            <div className="relative z-10">
              <h1 className="text-4xl font-serif tracking-widest mb-2" style={{ fontFamily: 'Georgia, serif' }}>METABEV</h1>
              <p className="text-xs uppercase tracking-[0.4em] opacity-60">Staff Performance Portal</p>
            </div>
            
            <div className="space-y-4 relative z-10">
               <p className="text-sm opacity-80 leading-relaxed italic">"Excellence is not a singular act, but a habit."</p>
            </div>
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
    <Layout 
      title={role === 'staff' ? 'My Performance Review' : 'Assessor Review Hub'} 
      role={role === 'staff' ? 'employee' : 'admin'} 
      onRoleSwitch={handleLogout}
      isSyncing={isSyncing}
    >
      <div className="max-w-7xl mx-auto">
        {role === 'staff' ? (
          currentAssessment ? (
            currentAssessment.status === 'reviewed' ? (
              showFullReport ? (
                <div className="animate-in fade-in duration-500">
                  <button onClick={() => setShowFullReport(false)} className="mb-6 text-sm font-bold text-brand-600 hover:underline">← Back to Summary</button>
                  {/* Reuse reporting logic or specialized component */}
                  <div className="bg-white p-12 rounded-3xl shadow-xl">Detailed View Content...</div>
                </div>
              ) : (
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
              <AssessmentForm initialData={currentAssessment} onSave={handleSaveAssessment} onSubmit={handleSubmitAssessment} />
            )
          ) : (
            <div className="bg-white p-12 rounded-3xl shadow-xl text-center">
              <h2 className="text-2xl font-black text-slate-800 mb-4">Registry Entry Not Found</h2>
              <p className="text-slate-500 max-w-lg mx-auto">The email <b>{currentUserEmail}</b> is not in the registry. Please contact your manager.</p>
              <button onClick={handleLogout} className="mt-8 text-brand-600 font-bold hover:underline">Sign Out & Try Another</button>
            </div>
          )
        ) : (
          <AdminDashboard 
            assessments={assessments} 
            currentUserEmail={currentUserEmail} 
            role={role} 
            onReviewComplete={async (upd) => {
               const next = assessments.map(a => a.id === upd.id ? upd : a);
               setAssessments(next);
               await syncToCloud(next);
            }} 
            onBulkUpload={handleBulkUpload} 
            onDeleteAssessment={onDeleteAssessment} 
            onRestoreBackup={async (restored) => {
              setAssessments(restored);
              await syncToCloud(restored);
            }} 
          />
        )}
      </div>
    </Layout>
  );
};

export default App;
