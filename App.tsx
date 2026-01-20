
import React, { useState, useEffect } from 'react';
import Layout, { Logo } from './components/Layout.tsx';
import AssessmentForm from './components/AssessmentForm.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import AppraisalReport from './components/AppraisalReport.tsx';
import { Assessment, RoleType } from './types.ts';
import { supabaseService } from './services/supabase.ts';
import confetti from 'canvas-confetti';

const MASTER_ADMIN_PASSWORD = "metabevadmin"; 
const SUPER_ADMIN_EMAIL = "admin@metabev.com";

const App: React.FC = () => {
  const [role, setRole] = useState<RoleType | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [staffEmailInput, setStaffEmailInput] = useState("");
  const [assessorEmailInput, setAssessorEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Ensure page starts at top on role change (login/logout)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [role]);

  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      const data = await supabaseService.getAllAssessments();
      if (data && data.length > 0) {
        setAssessments(data);
      } else {
        const saved = localStorage.getItem('metabev-assessments-v2');
        if (saved) { try { setAssessments(JSON.parse(saved)); } catch (e) {} }
      }
      setIsLoading(false);
    };
    initApp();
  }, []);

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = staffEmailInput.trim().toLowerCase();
    const userRecord = assessments.find(a => a.employeeDetails.email.toLowerCase() === email);
    if (!userRecord && email !== SUPER_ADMIN_EMAIL) {
      setAuthError(`Email "${email}" not found in registry.`);
      return;
    }
    setCurrentUserEmail(email);
    setRole('staff');
    setAuthError("");
  };

  const handleAssessorLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = assessorEmailInput.trim().toLowerCase();
    if (email === SUPER_ADMIN_EMAIL && passwordInput === MASTER_ADMIN_PASSWORD) {
      setCurrentUserEmail(email);
      setRole('admin');
      return;
    }
    const validManagerRecord = assessments.find(a => a.managerEmail.toLowerCase() === email && (a.managerPassword === passwordInput || (!a.managerPassword && passwordInput === 'metabev2025')));
    if (validManagerRecord) {
      setCurrentUserEmail(email);
      setRole('manager');
    } else {
      setAuthError("Invalid credentials.");
    }
  };

  const handleLogout = () => { setRole(null); setCurrentUserEmail(""); setAuthError(""); };

  const syncToCloud = async (updatedAssessments: Assessment[]): Promise<boolean> => {
    setIsSyncing(true);
    const result = await supabaseService.bulkSaveAssessments(updatedAssessments);
    setIsSyncing(false);
    if (!result.success) {
      alert(`Database Sync Failed: ${result.error}\n\nData is saved locally in your browser but NOT in the cloud.`);
    }
    return result.success;
  };

  const handleBulkUpload = async (newEntries: Assessment[]) => {
    const merged = [...assessments];
    newEntries.forEach(entry => {
      const email = entry.employeeDetails.email.toLowerCase();
      const idx = merged.findIndex(m => m.employeeDetails.email.toLowerCase() === email);
      if (idx === -1) merged.push(entry);
    });
    
    setAssessments(merged);
    localStorage.setItem('metabev-assessments-v2', JSON.stringify(merged));
    await syncToCloud(merged);
  };

  const currentAssessment = assessments.find(a => a.employeeDetails.email.toLowerCase() === currentUserEmail.toLowerCase());

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-900 p-4">
      <div className="w-16 h-16 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-xs font-black uppercase tracking-[0.4em] opacity-40">Initializing Portal...</p>
    </div>
  );

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 sm:p-12">
        <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden flex flex-col md:flex-row min-h-[640px]">
          <div className="bg-[#0f172a] md:w-5/12 p-16 text-white flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-[-20%] left-[-20%] w-[150%] h-[150%] opacity-20 pointer-events-none">
              <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-[120px] animate-pulse"></div>
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-cyan-500 rounded-full blur-[100px] animate-pulse delay-1000"></div>
            </div>
            <div className="relative z-10 flex flex-col items-start h-full">
              <div className="mb-12"><Logo light /></div>
              <div className="mt-auto space-y-6">
                <h3 className="text-2xl font-light leading-snug">“We can’t become what we <span className="text-blue-400 font-bold italic">need to be</span> by remaining what we are.”</h3>
              </div>
            </div>
          </div>
          <div className="md:w-7/12 p-16 flex flex-col justify-center bg-white">
            <div className="max-w-md mx-auto w-full">
              <h2 className="text-2xl sm:text-[1.75rem] md:text-3xl font-black text-slate-900 mb-12 tracking-tight whitespace-nowrap">Performance Review Portal</h2>
              <div className="space-y-12">
                <form onSubmit={handleStaffLogin} className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Team Member Portal</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="email" 
                      placeholder="Enter your email" 
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-medium focus:border-slate-900 outline-none transition-all placeholder:text-slate-300" 
                      value={staffEmailInput} 
                      onChange={(e) => setStaffEmailInput(e.target.value)} 
                      required 
                    />
                  </div>
                  <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:shadow-xl hover:bg-black transition-all transform active:scale-[0.98]">
                    Start Assessment
                  </button>
                </form>
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink mx-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Administrative Hub</span>
                  <div className="flex-grow border-t border-slate-100"></div>
                </div>
                <form onSubmit={handleAssessorLogin} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <input type="email" placeholder="Manager Email" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-medium focus:border-blue-600 outline-none transition-all placeholder:text-slate-300" value={assessorEmailInput} onChange={(e) => setAssessorEmailInput(e.target.value)} required />
                    <input type="password" placeholder="Access Password" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-medium focus:border-blue-600 outline-none transition-all placeholder:text-slate-300" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all transform active:scale-[0.98]">Assessor Login</button>
                </form>
                {authError && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-xs font-bold text-red-500 bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center gap-3">{authError}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout title={role === 'staff' ? 'Performance Review' : 'Manager Hub'} role={role === 'staff' ? 'employee' : 'admin'} onRoleSwitch={handleLogout} isSyncing={isSyncing}>
      {role === 'staff' ? (
        currentAssessment && (
          <AssessmentForm 
            initialData={currentAssessment} 
            onSave={(d) => { const n = assessments.map(a => a.id === d.id ? { ...d, updatedAt: new Date().toISOString() } : a); setAssessments(n); syncToCloud(n); }} 
            onSubmit={(d) => { 
              // Fixed: Added 'as const' to status to satisfy the Assessment interface and fixed explicit array type.
              const n: Assessment[] = assessments.map(a => a.id === d.id ? {...d, status: 'submitted' as const, submittedAt: new Date().toISOString()} : a); 
              setAssessments(n); 
              syncToCloud(n).then((s) => s && (confetti(), alert("Assessment submitted successfully!"))); 
            }} 
          />
        )
      ) : (
        <AdminDashboard 
          assessments={assessments} 
          currentUserEmail={currentUserEmail} 
          role={role} 
          onReviewComplete={(upd) => { 
            const final = { ...upd, reviewedAt: new Date().toISOString(), status: 'reviewed' as const };
            const n = assessments.map(a => a.id === upd.id ? final : a); 
            setAssessments(n); 
            syncToCloud(n).then((s) => s && alert("Assessment Finalized.")); 
          }} 
          onBulkUpload={handleBulkUpload} 
          onDeleteAssessment={(id) => { 
            if (confirm("Delete this record? This cannot be undone.")) {
              const n = assessments.filter(a => a.id !== id); 
              setAssessments(n); 
              supabaseService.deleteAssessment(id); 
            }
          }} 
          isSyncing={isSyncing} 
          onForceSync={() => syncToCloud(assessments).then(s => s && alert("Sync successful."))} 
        />
      )}
    </Layout>
  );
};

export default App;
