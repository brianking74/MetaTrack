
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
  const [selectedReviewType, setSelectedReviewType] = useState<'mid-year' | 'final' | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());
  const latestAssessmentRef = React.useRef<Map<string, Assessment>>(new Map());
  
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; error?: string }>({ connected: true });
  
  const [staffEmailInput, setStaffEmailInput] = useState("");
  const [staffPasswordInput, setStaffPasswordInput] = useState("");
  const [assessorEmailInput, setAssessorEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    return () => {
      syncTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
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
    const userRecords = assessments.filter(a => a.employeeDetails.email.toLowerCase() === email);
    if (userRecords.length === 0 && email !== SUPER_ADMIN_EMAIL) {
      setAuthError(`Email "${email}" not found in registry.`);
      return;
    }
    
    // Check password if not super admin
    if (email !== SUPER_ADMIN_EMAIL) {
      const expectedPassword = userRecords[0]?.employeePassword || 'metabev2025';
      if (staffPasswordInput !== expectedPassword) {
        setAuthError("Invalid password please try again or contact your manager/administrator.");
        return;
      }
    }

    setCurrentUserEmail(email);
    setRole('staff');
    setSelectedReviewType(null);
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

  const handleLogout = () => { 
    setRole(null); 
    setCurrentUserEmail(""); 
    setSelectedReviewType(null);
    setAuthError(""); 
  };

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
      console.log("%c[Sync] Attempting to save assessment...", "color: #2563eb; font-weight: bold;");
      
      // Log comments specifically for visibility
      const syncDebugData = {
        midYear: {
          kpis: updatedAssessment.kpis.map(k => ({ id: k.id, comment: k.midYearManagerComments })),
          devPlan: updatedAssessment.developmentPlan.midYearManagerComments,
          overall: updatedAssessment.overallPerformance.midYearManagerComments
        },
        final: {
          kpis: updatedAssessment.kpis.map(k => ({ id: k.id, comment: k.managerComments })),
          comps: updatedAssessment.coreCompetencies.map(c => ({ id: c.id, comment: c.managerComments })),
          devPlan: updatedAssessment.developmentPlan.managerComments,
          overall: updatedAssessment.overallPerformance.managerComments
        }
      };
      console.log("[Sync] Comments in payload:", syncDebugData);

      const result = await supabaseService.saveAssessment(updatedAssessment);
      if (!result.success) {
        setDbStatus({ connected: false, error: result.error });
        console.error("%c[Sync] Cloud Sync Error:", "color: #dc2626; font-weight: bold;", result.error);
        return false;
      } else {
        setDbStatus({ connected: true });
        console.log("%c[Sync] Cloud Sync Successful!", "color: #16a34a; font-weight: bold;");
        return true;
      }
    } catch (err) {
      console.error("%c[Sync] Fatal Sync Error:", "color: #dc2626; font-weight: bold;", err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const debouncedSync = (updatedAssessment: Assessment) => {
    const id = updatedAssessment.id;
    const existingTimeout = syncTimeoutRef.current.get(id);
    if (existingTimeout) clearTimeout(existingTimeout);
    
    const timeout = setTimeout(async () => {
      const latest = latestAssessmentRef.current.get(id);
      if (latest) {
        await syncSingleToCloud(latest);
      } else {
        await syncSingleToCloud(updatedAssessment);
      }
      syncTimeoutRef.current.delete(id);
    }, 1000); // 1 second debounce
    
    syncTimeoutRef.current.set(id, timeout);
  };

  const handleBulkUpload = async (newEntries: Assessment[]) => {
    const merged = [...assessments];
    
    // For each entry in the CSV, we want to ensure both a mid-year and a final record exist
    newEntries.forEach(entry => {
      const email = entry.employeeDetails.email.toLowerCase();
      
      ['mid-year', 'final'].forEach((type) => {
        const reviewType = type as 'mid-year' | 'final';
        const existingIdx = merged.findIndex(m => 
          m.employeeDetails.email.toLowerCase() === email && 
          m.reviewType === reviewType
        );
        
        if (existingIdx === -1) {
          // Create new record for this type
          merged.push({
            ...entry,
            id: `mb-${reviewType}-${Math.random().toString(36).substr(2, 9)}`,
            reviewType: reviewType
          });
        } else {
          // Update existing entry but preserve comments and status
          const existing = merged[existingIdx];
          merged[existingIdx] = {
            ...existing,
            employeeDetails: { ...existing.employeeDetails, ...entry.employeeDetails },
            managerName: entry.managerName,
            managerEmail: entry.managerEmail,
            managerPassword: entry.managerPassword || existing.managerPassword,
            employeePassword: entry.employeePassword || existing.employeePassword,
            // Merge KPIs to preserve comments
            kpis: entry.kpis.map(newKpi => {
              const existingKpi = existing.kpis.find(ek => ek.id === newKpi.id || ek.title === newKpi.title);
              if (existingKpi) {
                return { 
                  ...existingKpi, 
                  title: newKpi.title, 
                  description: newKpi.description 
                };
              }
              return newKpi;
            }),
            developmentPlan: {
              ...existing.developmentPlan,
              developmentGoal: entry.developmentPlan.developmentGoal
            },
            updatedAt: new Date().toISOString()
          };
        }
      });
    });
    
    setAssessments(merged);
    localStorage.setItem('metabev-assessments-v2', JSON.stringify(merged));
    await syncToCloud(merged);
  };

  const currentAssessments = assessments.filter(a => a.employeeDetails.email.toLowerCase() === currentUserEmail.toLowerCase());
  const midYearAssessment = currentAssessments.find(a => a.reviewType === 'mid-year');
  const finalAssessment = currentAssessments.find(a => a.reviewType === 'final');

  const isMidYearCompleted = midYearAssessment?.status === 'reviewed';
  const isMidYearSubmitted = midYearAssessment?.status === 'submitted';

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

  const currentAssessment = selectedReviewType === 'mid-year' ? midYearAssessment : finalAssessment;

  return (
    <Layout title={role === 'staff' ? 'Performance Review' : 'Manager Hub'} role={role === 'staff' ? 'employee' : 'admin'} onRoleSwitch={handleLogout} isSyncing={isSyncing}>
      {role === 'staff' ? (
        !selectedReviewType ? (
          <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-slate-900 mb-4">Select Review Stage</h2>
              <p className="text-slate-500">Please select the review stage you wish to complete.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Mid-Year Card */}
              <div 
                onClick={() => !isMidYearCompleted && setSelectedReviewType('mid-year')}
                className={`p-10 rounded-[2.5rem] border-2 transition-all cursor-pointer group relative overflow-hidden ${
                  isMidYearCompleted 
                    ? 'bg-slate-50 border-slate-200 opacity-75 grayscale cursor-not-allowed' 
                    : 'bg-white border-blue-100 hover:border-blue-500 hover:shadow-2xl shadow-lg'
                }`}
              >
                <div className="relative z-10">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isMidYearCompleted ? 'bg-slate-200 text-slate-400' : 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors'}`}>
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Mid-Year Review</h3>
                  <p className="text-sm text-slate-500 mb-6">Reflection on progress and goals for the first half of the year.</p>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      isMidYearCompleted ? 'bg-green-50 text-green-600 border-green-200' : 
                      isMidYearSubmitted ? 'bg-blue-50 text-blue-600 border-blue-200' :
                      'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      {isMidYearCompleted ? 'Completed' : isMidYearSubmitted ? 'Submitted' : 'Available'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Final Year Card */}
              <div 
                onClick={() => isMidYearCompleted && setSelectedReviewType('final')}
                className={`p-10 rounded-[2.5rem] border-2 transition-all group relative overflow-hidden ${
                  !isMidYearCompleted 
                    ? 'bg-slate-50 border-slate-200 opacity-50 grayscale cursor-not-allowed' 
                    : 'bg-white border-brand-100 hover:border-brand-500 hover:shadow-2xl shadow-lg cursor-pointer'
                }`}
              >
                <div className="relative z-10">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${!isMidYearCompleted ? 'bg-slate-200 text-slate-400' : 'bg-brand-100 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors'}`}>
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Final Year Review</h3>
                  <p className="text-sm text-slate-500 mb-6">Comprehensive annual performance evaluation and core competencies.</p>
                  <div className="flex items-center gap-2">
                    {!isMidYearCompleted ? (
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Locked until Mid-Year is Completed
                      </span>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        finalAssessment?.status === 'reviewed' ? 'bg-green-50 text-green-600 border-green-200' : 
                        finalAssessment?.status === 'submitted' ? 'bg-brand-50 text-brand-600 border-brand-200' :
                        'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        {finalAssessment?.status === 'reviewed' ? 'Completed' : finalAssessment?.status === 'submitted' ? 'Submitted' : 'Available'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-12 text-center">
              <button 
                onClick={handleLogout}
                className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        ) : (
          currentAssessment && (
            <div className="space-y-6">
              <button 
                onClick={() => setSelectedReviewType(null)}
                className="text-xs font-black text-brand-600 uppercase tracking-widest hover:underline flex items-center gap-2 mb-4"
              >
                &larr; Back to Selection
              </button>
              <AssessmentForm 
                initialData={currentAssessment} 
                onSave={(d) => { 
                  const updatedWithTimestamp = { ...d, updatedAt: new Date().toISOString() };
                  setAssessments(prev => prev.map(a => a.id === d.id ? updatedWithTimestamp : a)); 
                  latestAssessmentRef.current.set(d.id, updatedWithTimestamp);
                  debouncedSync(updatedWithTimestamp); 
                }} 
                onSubmit={(d) => { 
                  const final = {
                    ...d, 
                    status: 'submitted' as const, 
                    submittedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  };
                  setAssessments(prev => prev.map(a => a.id === d.id ? final : a)); 
                  latestAssessmentRef.current.set(d.id, final);
                  const existingTimeout = syncTimeoutRef.current.get(d.id);
                  if (existingTimeout) {
                    clearTimeout(existingTimeout);
                    syncTimeoutRef.current.delete(d.id);
                  }
                  syncSingleToCloud(final).then((s) => s && (confetti(), alert(`${d.reviewType === 'mid-year' ? 'Mid-Year' : 'Final'} Review submitted successfully!`))); 
                }} 
              />
            </div>
          )
        )
      ) : (
        <AdminDashboard 
          assessments={assessments} 
          currentUserEmail={currentUserEmail} 
          role={role} 
          onReviewComplete={(upd) => { 
            const final = { 
              ...upd, 
              reviewedAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString(),
              status: 'reviewed' as const 
            };
            setAssessments(prev => prev.map(a => a.id === upd.id ? final : a)); 
            latestAssessmentRef.current.set(upd.id, final);
            const existingTimeout = syncTimeoutRef.current.get(upd.id);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
              syncTimeoutRef.current.delete(upd.id);
            }
            syncSingleToCloud(final).then((s) => s && alert("Assessment Finalized.")); 
          }} 
          onUpdate={(upd, immediate) => {
            const updatedWithTimestamp = { ...upd, updatedAt: new Date().toISOString() };
            setAssessments(prev => prev.map(a => a.id === upd.id ? updatedWithTimestamp : a));
            
            // Always update the ref for this specific assessment
            latestAssessmentRef.current.set(upd.id, updatedWithTimestamp);
            
            if (immediate) {
              const existingTimeout = syncTimeoutRef.current.get(upd.id);
              if (existingTimeout) {
                clearTimeout(existingTimeout);
                syncTimeoutRef.current.delete(upd.id);
              }
              syncSingleToCloud(updatedWithTimestamp);
            } else {
              debouncedSync(updatedWithTimestamp);
            }
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
