
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
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const latestAssessmentRef = React.useRef<Assessment | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; error?: string }>({ connected: true });
  
  const [staffEmailInput, setStaffEmailInput] = useState("");
  const [staffPasswordInput, setStaffPasswordInput] = useState("");
  const [assessorEmailInput, setAssessorEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [role]);

  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      
      // Check database connection first
      const conn = await supabaseService.checkConnection();
      setDbStatus({ connected: conn.success, error: conn.error });
      
      const { data, error } = await supabaseService.getAllAssessments();
      
      if (error) {
        // If fetch failed, try to load from local storage as fallback
        const saved = localStorage.getItem('metabev-assessments-v2');
        if (saved) { 
          try { 
            setAssessments(JSON.parse(saved)); 
          } catch (e) {
            console.error('Failed to parse local storage', e);
          } 
        }
        setDbStatus(prev => ({ ...prev, connected: false, error: `Fetch error: ${error}` }));
      } else {
        // If fetch succeeded (even if empty), use it
        setAssessments(data);
        localStorage.setItem('metabev-assessments-v2', JSON.stringify(data));
        setDbStatus(prev => ({ ...prev, connected: true, error: undefined }));
      }
      setIsLoading(false);
    };
    initApp();
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    const { data, error } = await supabaseService.getAllAssessments();
    setIsSyncing(false);
    
    if (error) {
      setAuthError(`Sync failed: ${error}`);
    } else {
      setAssessments(data);
      localStorage.setItem('metabev-assessments-v2', JSON.stringify(data));
      setAuthError("");
      alert(`Sync successful! Found ${data.length} records.`);
    }
  };

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = staffEmailInput.trim().toLowerCase();
    const userRecord = assessments.find(a => a.employeeDetails.email.toLowerCase() === email);
    if (!userRecord && email !== SUPER_ADMIN_EMAIL) {
      setAuthError(`Email "${email}" not found in registry.`);
      return;
    }
    
    // Check password if not super admin
    if (email !== SUPER_ADMIN_EMAIL) {
      const expectedPassword = userRecord?.employeePassword || 'metabev2025';
      if (staffPasswordInput !== expectedPassword) {
        setAuthError("Invalid password please try again or contact your manager/administrator.");
        return;
      }
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
      setDbStatus({ connected: false, error: result.error });
      alert(`Cloud Sync Error:\n\n${result.error}\n\nDon't worry, your work is still saved in this browser's local memory. You can try again later.`);
    } else {
      setDbStatus({ connected: true });
    }
    return result.success;
  };

  const syncSingleToCloud = async (updatedAssessment: Assessment): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const result = await supabaseService.saveAssessment(updatedAssessment);
      if (!result.success) {
        setDbStatus({ connected: false, error: result.error });
        console.error("Cloud Sync Error:", result.error);
        return false;
      } else {
        setDbStatus({ connected: true });
        return true;
      }
    } catch (err) {
      console.error("Fatal Sync Error:", err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const debouncedSync = (updatedAssessment: Assessment) => {
    latestAssessmentRef.current = updatedAssessment;
    
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    
    syncTimeoutRef.current = setTimeout(async () => {
      if (latestAssessmentRef.current) {
        // We use the ref value to ensure we always sync the most recent state
        await syncSingleToCloud(latestAssessmentRef.current);
      }
    }, 1500); // Increased to 1.5s for better stability
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
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 sm:p-12">
        {!dbStatus.connected && (
          <div className="w-full max-w-5xl mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-2xl shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-700 font-bold">Cloud Database Unavailable</p>
                <p className="text-xs text-amber-600 mt-1">{dbStatus.error || 'The system could not connect to the cloud server. Changes will be saved locally in your browser.'}</p>
              </div>
            </div>
          </div>
        )}
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
                    <input 
                      type="password" 
                      placeholder="Enter your password" 
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-medium focus:border-slate-900 outline-none transition-all placeholder:text-slate-300 mt-4" 
                      value={staffPasswordInput} 
                      onChange={(e) => setStaffPasswordInput(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:shadow-xl hover:bg-black transition-all transform active:scale-[0.98]">
                      Start Assessment
                    </button>
                    {assessments.length === 0 && (
                      <button 
                        type="button" 
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline disabled:opacity-50"
                      >
                        {isSyncing ? 'Syncing...' : 'Registry empty? Click to Sync'}
                      </button>
                    )}
                  </div>
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
                  <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all transform active:scale-[0.98]">Manager Login</button>
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
            onSave={(d) => { 
              const updatedWithTimestamp = { ...d, updatedAt: new Date().toISOString() };
              setAssessments(prev => prev.map(a => a.id === d.id ? updatedWithTimestamp : a)); 
              debouncedSync(updatedWithTimestamp); 
            }} 
            onSubmit={(d) => { 
              const final = {...d, status: 'submitted' as const, submittedAt: new Date().toISOString()};
              setAssessments(prev => prev.map(a => a.id === d.id ? final : a)); 
              syncSingleToCloud(final).then((s) => s && (confetti(), alert("Assessment submitted successfully!"))); 
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
            setAssessments(prev => prev.map(a => a.id === upd.id ? final : a)); 
            syncSingleToCloud(final).then((s) => s && alert("Assessment Finalized.")); 
          }} 
          onUpdate={(upd) => {
            const updatedWithTimestamp = { ...upd, updatedAt: new Date().toISOString() };
            setAssessments(prev => prev.map(a => a.id === upd.id ? updatedWithTimestamp : a));
            debouncedSync(updatedWithTimestamp);
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
