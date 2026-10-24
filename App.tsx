
import React, { useState, useEffect } from 'react';
import Layout, { Logo } from './components/Layout.tsx';
import loginIllustration from './assets/metabev-login-illustration.jpeg';
import AssessmentForm from './components/AssessmentForm.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import AppraisalReport from './components/AppraisalReport.tsx';
import ExpenseClaims from './components/ExpenseClaims.tsx';
import { Assessment, RoleType } from './types.ts';
import { supabaseService } from './services/supabase.ts';
import { EXPENSES_ENABLED, isExpensePilotUser, EXPENSE_GM_EMAIL } from './constants.ts';
import confetti from 'canvas-confetti';

// The administrator account. Its password lives ONLY as a salted hash inside
// Supabase Auth (provisioned by supabase/import-users.mjs) - it no longer
// exists anywhere in this source code.
const SUPER_ADMIN_EMAIL = "admin@metabev.com";

// Local fallback cache holds ONLY the signed-in person's own records with
// password fields stripped, so a visitor's browser never stores the whole
// staff database (the old 'metabev-assessments-v2' key did exactly that).
const MY_CACHE_KEY = 'metabev-my-reviews';
const LEGACY_CACHE_KEY = 'metabev-assessments-v2';

const sanitizeForCache = (a: Assessment): Assessment => {
  // Defensive: records fetched before strip_passwords.sql ran may still carry
  // password fields - they must never be written into the local cache.
  const legacy = a as Assessment & { managerPassword?: unknown; employeePassword?: unknown };
  const { managerPassword: _mp, employeePassword: _ep, ...rest } = legacy;
  return rest as Assessment;
};

const cacheRelevantReviews = (email: string, assessments: Assessment[]) => {
  if (!email) return;
  const mine = assessments.filter(a =>
    a.employeeDetails.email.toLowerCase() === email.toLowerCase() ||
    a.managerEmail.toLowerCase() === email.toLowerCase()
  );
  try {
    localStorage.setItem(MY_CACHE_KEY, JSON.stringify(mine.map(sanitizeForCache)));
  } catch (e) {
    console.error('Failed to write local cache', e);
  }
};

const loadCachedReviews = (): Assessment[] => {
  try {
    const saved = localStorage.getItem(MY_CACHE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Failed to read local cache', e);
    return [];
  }
};

const App: React.FC = () => {
  const [role, setRole] = useState<RoleType | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [selectedReviewType, setSelectedReviewType] = useState<'mid-year' | 'final' | null>(null);
  const [staffTab, setStaffTab] = useState<'review' | 'expenses'>('review');
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
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showStaffPw, setShowStaffPw] = useState(false);
  const [showMgrPw, setShowMgrPw] = useState(false);

  useEffect(() => {
    return () => {
      syncTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [role]);

  useEffect(() => {
    let cancelled = false;

    // Shared post-login routine: RLS decides which rows the caller may see,
    // and the role mirrors exactly what the database allows.
    const enterWith = async (email: string) => {
      const { data, error } = await supabaseService.getAllAssessments();
      if (cancelled) return;

      if (error) {
        setAssessments(loadCachedReviews());
        setDbStatus({ connected: false, error: `Fetch error: ${error}` });
      } else {
        setAssessments(data);
        setDbStatus({ connected: true });
        cacheRelevantReviews(email, data);
      }

      setCurrentUserEmail(email);
      if (email === SUPER_ADMIN_EMAIL) {
        setRole('admin');
      } else if (
        !error &&
        (data.some(a => a.managerEmail.toLowerCase() === email) ||
         // The GM keeps the Manager Hub on refresh too - she has no direct
         // reports in the registry but owns the final approval stage
         // (mirrors the isGmLogin check in handleAssessorLogin).
         email === EXPENSE_GM_EMAIL.toLowerCase())
      ) {
        setRole('manager');
      } else {
        setRole('staff');
      }
    };

    const initApp = async () => {
      setIsLoading(true);

      // Purge the legacy cache that stored the entire staff database (with passwords)
      localStorage.removeItem(LEGACY_CACHE_KEY);

      const conn = await supabaseService.checkConnection();
      if (cancelled) return;
      setDbStatus({ connected: conn.success, error: conn.error });

      // Restore a persisted Supabase Auth session (survives page refresh).
      const { email } = await supabaseService.getSession();
      if (cancelled) return;
      if (email) await enterWith(email);
      setIsLoading(false);
    };

    initApp();

    // If another browser tab signs out, reset this tab as well.
    const unsubscribe = supabaseService.onSignedOut(() => {
      setRole(null);
      setCurrentUserEmail("");
      setSelectedReviewType(null);
      setStaffTab('review');
      setAssessments([]);
      localStorage.removeItem(MY_CACHE_KEY);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = staffEmailInput.trim().toLowerCase();

    // The administrator account has no staff records - it must go through
    // the Manager Login form below.
    if (email === SUPER_ADMIN_EMAIL) {
      setAuthError('Administrator account detected. Please use the Manager Login form below.');
      return;
    }

    setIsSigningIn(true);
    try {
      // Real server-side authentication (password verified by Supabase Auth).
      const result = await supabaseService.signIn(email, staffPasswordInput);
      if (!result.success) {
        setAuthError(result.error || 'Login failed.');
        return;
      }

      // With RLS this returns only rows this person is allowed to see.
      const { data, error } = await supabaseService.getAllAssessments();
      if (error) {
        setAuthError(`Signed in, but could not load your reviews: ${error}`);
        return;
      }

      const ownRows = data.filter(a => a.employeeDetails.email.toLowerCase() === email);
      if (ownRows.length === 0) {
        await supabaseService.signOut();
        setAuthError(`No reviews are assigned to "${email}" yet. Please contact your administrator to be added to the registry.`);
        return;
      }

      setAssessments(data);
      setCurrentUserEmail(email);
      setRole('staff');
      setSelectedReviewType(null);
      setStaffTab('review');
      setStaffPasswordInput("");
      cacheRelevantReviews(email, data);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAssessorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = assessorEmailInput.trim().toLowerCase();

    setIsSigningIn(true);
    try {
      const result = await supabaseService.signIn(email, passwordInput);
      if (!result.success) {
        setAuthError(result.error || 'Login failed.');
        return;
      }

      const { data, error } = await supabaseService.getAllAssessments();
      if (error) {
        setAuthError(`Signed in, but could not load data: ${error}`);
        return;
      }

      if (email === SUPER_ADMIN_EMAIL) {
        setAssessments(data);
        setCurrentUserEmail(email);
        setRole('admin');
        setPasswordInput("");
        cacheRelevantReviews(email, data);
        return;
      }

      const managedRows = data.filter(a => a.managerEmail.toLowerCase() === email);
      // The General Manager signs in here too - she may not have direct
      // reports in the registry, but she owns the FINAL approval stage for
      // every expense claim in the company (GM Approvals tab).
      const isGmLogin = email === EXPENSE_GM_EMAIL.toLowerCase();
      if (managedRows.length === 0 && !isGmLogin) {
        await supabaseService.signOut();
        setAuthError(`"${email}" has no team reports. If you are a team member, please use the Team Member Portal above.`);
        return;
      }

      setAssessments(data);
      setCurrentUserEmail(email);
      setRole('manager');
      setPasswordInput("");
      cacheRelevantReviews(email, data);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await supabaseService.signOut();
    setRole(null);
    setCurrentUserEmail("");
    setSelectedReviewType(null);
    setStaffTab('review');
    setAuthError("");
    setAssessments([]);
    // Shared-computer hygiene: drop the cached reviews on sign-out.
    localStorage.removeItem(MY_CACHE_KEY);
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
      const result = await supabaseService.saveAssessment(updatedAssessment);
      if (!result.success) {
        setDbStatus({ connected: false, error: result.error });
        return false;
      }
      setDbStatus({ connected: true });
      return true;
    } catch (err) {
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
    let addedCount = 0;
    let skippedCount = 0;
    
    // For each entry in the CSV, we want to ensure both a mid-year and a final record exist
    newEntries.forEach(entry => {
      const email = entry.employeeDetails.email.toLowerCase();
      
      let isNewUser = false;
      let isExistingUser = false;

      ['mid-year', 'final'].forEach((type) => {
        const reviewType = type as 'mid-year' | 'final';
        const existingIdx = merged.findIndex(m => 
          m.employeeDetails.email.toLowerCase() === email && 
          m.reviewType === reviewType
        );
        
        if (existingIdx === -1) {
          // Create new record for this type (collision-resistant ID)
          const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID().replace(/-/g, '')
            : Math.random().toString(36).slice(2) + Date.now().toString(36);
          merged.push({
            ...entry,
            id: `mb-${reviewType}-${uuid.slice(0, 12)}`,
            reviewType: reviewType
          });
          isNewUser = true;
        } else {
          isExistingUser = true;
        }
      });
      
      if (isNewUser) addedCount++;
      else if (isExistingUser) skippedCount++;
    });
    
    setAssessments(merged);
    await syncToCloud(merged);
    
    alert(`Upload Complete:\n${addedCount} new users added.\n${skippedCount} existing users skipped.\n\nIMPORTANT: brand-new users can only sign in once an Auth account exists for them - the administrator should re-run supabase/import-users.mjs to provision them.`);
  };

  const currentAssessments = assessments.filter(a => a.employeeDetails.email.toLowerCase() === currentUserEmail.toLowerCase());
  const midYearAssessment = currentAssessments.find(a => a.reviewType === 'mid-year');
  const finalAssessment = currentAssessments.find(a => a.reviewType === 'final');
  // The staff member's manager (from their registry record) drives expense routing.
  const myStaffRecord = currentAssessments[0];

  // Routing for the signed-in person's OWN expense claims: their line manager
  // on file; managers without one (top-level) route to the administrator,
  // who approves them in the admin Expenses dashboard. Self-approval is
  // impossible because the approver can never be the claimant here.
  const myEmailLower = currentUserEmail.toLowerCase().trim();
  const ownManagerEmail = (myStaffRecord?.managerEmail || '').toLowerCase().trim();
  const ownManagerIsSet = !!ownManagerEmail && ownManagerEmail.includes('@') && ownManagerEmail !== myEmailLower;
  const expenseApproverEmail = ownManagerIsSet ? ownManagerEmail : SUPER_ADMIN_EMAIL;
  const expenseApproverName = ownManagerIsSet ? myStaffRecord?.managerName : undefined;

  // PILOT MODE: while the expense module is being tested, only staff accounts
  // on the EXPENSES_PILOT_EMAILS list (constants.ts) get the Expenses tab -
  // it is hidden completely from everyone else. Managers/admins are unaffected.
  const staffExpensesLive = EXPENSES_ENABLED && isExpensePilotUser(currentUserEmail);

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
      <div className="min-h-screen bg-[#F4F5FA] flex flex-col items-center justify-center p-6 sm:p-12">
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
        <div className="w-full max-w-4xl bg-white rounded-3xl border border-[#EAEAF0] shadow-[0_20px_60px_-15px_rgba(47,43,61,0.15)] overflow-hidden flex flex-col md:flex-row">
          {/* Illustration panel - Sneat-style split auth card */}
          <div className="hidden md:flex md:w-1/2 bg-[#F3F2F9] flex-col items-center justify-center p-10 lg:p-14">
            <img src={loginIllustration} alt="MetaBev team member managing digital tasks" className="w-full max-w-[420px] mix-blend-multiply select-none pointer-events-none" draggable={false} />
            <p className="mt-8 max-w-[300px] text-center text-[13px] leading-relaxed text-[#6D6684]">“We can’t become what we <span className="text-[#7367F0] font-semibold">need to be</span> by remaining what we are.”</p>
          </div>
          {/* Form panel */}
          <div className="md:w-1/2 p-8 sm:p-12 lg:px-14 lg:py-14 flex flex-col justify-center bg-white">
            <div className="max-w-[380px] mx-auto w-full">
              <div className="mb-8"><Logo /></div>
              <h1 className="text-[1.75rem] font-bold text-[#2F2B3D] tracking-tight mb-8">Employee Portal</h1>
              <form onSubmit={handleStaffLogin} className="space-y-4">
                <span className="text-[11px] font-bold text-[#8B8796] uppercase tracking-[0.18em] block mb-1">Team Member Portal</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8AAB4] pointer-events-none">
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </span>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="w-full pl-11 pr-4 py-3 bg-white border border-[#DBDAE3] rounded-[10px] text-[15px] text-[#2F2B3D] font-medium placeholder:text-[#A8AAB4] outline-none focus:border-[#7367F0] focus:ring-[3px] focus:ring-[#7367F0]/20 transition-all"
                    value={staffEmailInput}
                    onChange={(e) => setStaffEmailInput(e.target.value)}
                    required
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8AAB4] pointer-events-none">
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </span>
                  <input
                    type={showStaffPw ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="w-full pl-11 pr-11 py-3 bg-white border border-[#DBDAE3] rounded-[10px] text-[15px] text-[#2F2B3D] font-medium placeholder:text-[#A8AAB4] outline-none focus:border-[#7367F0] focus:ring-[3px] focus:ring-[#7367F0]/20 transition-all"
                    value={staffPasswordInput}
                    onChange={(e) => setStaffPasswordInput(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowStaffPw(!showStaffPw)} aria-label={showStaffPw ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8AAB4] hover:text-[#7367F0] transition-colors">
                    {showStaffPw ? (
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29" /></svg>
                    ) : (
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                <button type="submit" disabled={isSigningIn} className="w-full bg-[#7367F0] hover:bg-[#685DD8] text-white py-3 rounded-[10px] font-semibold text-[15px] shadow-[0_8px_16px_-6px_rgba(115,103,240,0.5)] transition-all active:scale-[0.98] disabled:opacity-60">
                  {isSigningIn ? 'Signing in...' : 'Staff Login'}
                </button>
              </form>
              <div className="relative flex items-center my-7">
                <div className="flex-grow border-t border-[#EAEAF0]"></div>
                <span className="flex-shrink mx-4 text-[11px] font-bold text-[#8B8796] uppercase tracking-[0.18em]">Administrative Hub</span>
                <div className="flex-grow border-t border-[#EAEAF0]"></div>
              </div>
              <form onSubmit={handleAssessorLogin} className="space-y-4">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8AAB4] pointer-events-none">
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </span>
                  <input
                    type="email"
                    placeholder="Manager Email"
                    className="w-full pl-11 pr-4 py-3 bg-white border border-[#DBDAE3] rounded-[10px] text-[15px] text-[#2F2B3D] font-medium placeholder:text-[#A8AAB4] outline-none focus:border-[#7367F0] focus:ring-[3px] focus:ring-[#7367F0]/20 transition-all"
                    value={assessorEmailInput}
                    onChange={(e) => setAssessorEmailInput(e.target.value)}
                    required
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8AAB4] pointer-events-none">
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </span>
                  <input
                    type={showMgrPw ? 'text' : 'password'}
                    placeholder="Access Password"
                    className="w-full pl-11 pr-11 py-3 bg-white border border-[#DBDAE3] rounded-[10px] text-[15px] text-[#2F2B3D] font-medium placeholder:text-[#A8AAB4] outline-none focus:border-[#7367F0] focus:ring-[3px] focus:ring-[#7367F0]/20 transition-all"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowMgrPw(!showMgrPw)} aria-label={showMgrPw ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8AAB4] hover:text-[#7367F0] transition-colors">
                    {showMgrPw ? (
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29" /></svg>
                    ) : (
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                <button type="submit" disabled={isSigningIn} className="w-full bg-[#7367F0]/10 hover:bg-[#7367F0]/20 text-[#7367F0] py-3 rounded-[10px] font-semibold text-[15px] transition-all active:scale-[0.98] disabled:opacity-60">
                  {isSigningIn ? 'Signing in...' : 'Manager Login'}
                </button>
              </form>
              {authError && (
                <div className="mt-5 p-4 rounded-[10px] bg-[#FE4956]/10 border border-[#FE4956]/25">
                  <p className="text-[13px] font-semibold text-[#E23A46]">{authError}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="mt-8 text-[11px] font-bold text-[#A8AAB4] uppercase tracking-[0.25em]">METABEV Employee Portal</p>
      </div>
    );
  }

  const currentAssessment = selectedReviewType === 'mid-year' ? midYearAssessment : finalAssessment;

  return (
    <Layout title={role === 'staff' ? (staffTab === 'expenses' && staffExpensesLive ? 'Expense Claims' : 'Performance Review') : 'Manager Hub'} role={role === 'staff' ? 'employee' : 'admin'} onRoleSwitch={handleLogout} isSyncing={isSyncing}>
      {role === 'staff' ? (
        <>
          {/* Portal tabs - Performance Review | Expense Claims */}
          <div className="max-w-4xl mx-auto flex gap-6 border-b border-slate-200 mb-2 no-print">
            <button onClick={() => setStaffTab('review')} className={`pb-4 px-2 text-sm font-bold transition-all relative ${staffTab === 'review' ? 'text-brand-600' : 'text-slate-400'}`}>
              Performance Review
              {staffTab === 'review' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600"></div>}
            </button>
            {staffExpensesLive ? (
              <button onClick={() => setStaffTab('expenses')} className={`pb-4 px-2 text-sm font-bold transition-all relative ${staffTab === 'expenses' ? 'text-brand-600' : 'text-slate-400'}`}>
                Expense Claims
                {staffTab === 'expenses' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-600"></div>}
              </button>
            ) : !EXPENSES_ENABLED ? (
              <button disabled title="Expense Claims - coming soon" className="pb-4 px-2 text-sm font-bold text-slate-300 cursor-not-allowed flex items-center gap-2">
                Expense Claims
                <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 border border-slate-200">Soon</span>
              </button>
            ) : null}
          </div>

          {staffTab === 'expenses' && staffExpensesLive ? (
            <ExpenseClaims
              staffName={myStaffRecord?.employeeDetails.fullName || currentUserEmail}
              staffEmail={currentUserEmail}
              managerEmail={myStaffRecord?.managerEmail || ''}
              managerName={myStaffRecord?.managerName}
            />
          ) : (
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
          )}
        </>
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
          onDeleteAssessment={async (id) => { 
            if (confirm("Delete this record? This cannot be undone.")) {
              const result = await supabaseService.deleteAssessment(id);
              if (result.success) {
                const n = assessments.filter(a => a.id !== id); 
                setAssessments(n);
                cacheRelevantReviews(currentUserEmail, n);
              } else {
                alert(`Delete failed: ${result.error}\n\nThe record was NOT deleted.`);
              }
            }
          }} 
          isSyncing={isSyncing} 
          onForceSync={() => syncToCloud(assessments).then(s => s && alert("Sync successful."))} 
          expenseProfile={{
            staffName: myStaffRecord?.employeeDetails.fullName || currentUserEmail,
            managerEmail: expenseApproverEmail,
            managerName: expenseApproverName
          }}
        />
      )}
    </Layout>
  );
};

export default App;
