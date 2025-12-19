
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import AssessmentForm from './components/AssessmentForm.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import { Assessment, Role } from './types.ts';
import confetti from 'canvas-confetti';

const ADMIN_PASSWORD = "metabevadmin"; // Simple demonstration password

const App: React.FC = () => {
  const [role, setRole] = useState<Role>('employee');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeDraft, setActiveDraft] = useState<Assessment | undefined>();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('metabev-assessments');
    if (saved) {
      const parsed = JSON.parse(saved);
      setAssessments(parsed);
      // Find the latest draft
      const draft = parsed.find((a: Assessment) => a.status === 'draft');
      if (draft) setActiveDraft(draft);
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('metabev-assessments', JSON.stringify(assessments));
  }, [assessments]);

  const handleRoleSwitchRequest = () => {
    if (role === 'employee') {
      setShowLoginModal(true);
      setLoginError("");
      setPasswordInput("");
    } else {
      setRole('employee');
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setRole('admin');
      setShowLoginModal(false);
      setPasswordInput("");
      setLoginError("");
    } else {
      setLoginError("Invalid administrator password. Please try again.");
    }
  };

  const fireConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const handleSaveDraft = (data: Assessment) => {
    setAssessments(prev => {
      const existing = prev.find(a => a.id === data.id);
      if (existing) {
        return prev.map(a => a.id === data.id ? data : a);
      }
      return [...prev, data];
    });
    setActiveDraft(data);
  };

  const handleSubmit = (data: Assessment) => {
    if (!data.employeeDetails.fullName) {
      alert("Please provide your full name in the Overview section before submitting.");
      return;
    }
    const submittedData = { ...data, status: 'submitted' as const, submittedAt: new Date().toISOString() };
    setAssessments(prev => {
      const existing = prev.find(a => a.id === data.id);
      if (existing) {
        return prev.map(a => a.id === data.id ? submittedData : a);
      }
      return [...prev, submittedData];
    });
    setActiveDraft(undefined);
    
    // Trigger celebration
    fireConfetti();
  };

  const handleAdminReviewComplete = (updated: Assessment) => {
    setAssessments(prev => prev.map(a => a.id === updated.id ? updated : a));
    alert(`Review for ${updated.employeeDetails.fullName} completed.`);
  };

  // For demo, we consider the "current" view based on if anything is submitted
  const hasSubmitted = assessments.some(a => a.status !== 'draft');

  return (
    <>
      <Layout 
        title={role === 'employee' ? 'Staff Performance Review' : 'Assessor Review Hub'} 
        role={role} 
        onRoleSwitch={handleRoleSwitchRequest}
      >
        {role === 'employee' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {!hasSubmitted || activeDraft ? (
              <div className="max-w-4xl mx-auto">
                <div className="mb-6 p-4 bg-brand-50 border border-brand-100 rounded-lg text-sm text-brand-800 flex items-center gap-3">
                   <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                   </svg>
                   Complete each section of your annual performance appraisal. You can save your progress as a draft anytime.
                </div>
                <AssessmentForm 
                  initialData={activeDraft} 
                  onSave={handleSaveDraft} 
                  onSubmit={handleSubmit} 
                />
              </div>
            ) : (
              <div className="max-w-2xl mx-auto text-center py-24 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative">
                {/* Decorative background circle */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-50 rounded-full blur-3xl opacity-50"></div>
                
                <div className="relative z-10">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner animate-bounce">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Thanks for submitting your assessment.</h3>
                  <p className="text-slate-500 mb-10 text-lg leading-relaxed max-w-md mx-auto">Your performance appraisal has been successfully logged. An assessor will review your input shortly.</p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                      onClick={() => {
                        const ok = confirm("Are you sure you want to clear your submission and start a fresh form? This action cannot be undone.");
                        if(ok) {
                          setAssessments([]);
                          setActiveDraft(undefined);
                        }
                      }}
                      className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      Start Fresh Form
                    </button>
                    <button 
                      disabled
                      className="px-8 py-3 bg-brand-50 text-brand-400 rounded-xl font-bold cursor-not-allowed border border-brand-100"
                    >
                      View Receipt
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <AdminDashboard 
              assessments={assessments} 
              onReviewComplete={handleAdminReviewComplete} 
            />
          </div>
        )}
      </Layout>

      {/* Branded Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex justify-center mb-6">
                 <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                   </svg>
                 </div>
              </div>
              <h3 className="text-2xl font-black text-center text-slate-900 mb-2">Assessor Login</h3>
              <p className="text-slate-500 text-center text-sm mb-8">Please enter the administrator credentials to access the review dashboard.</p>
              
              <form onSubmit={handleLoginSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                  <input 
                    type="password"
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all text-slate-800"
                    placeholder="••••••••"
                  />
                  {loginError && <p className="mt-2 text-xs font-bold text-red-500">{loginError}</p>}
                </div>
                
                <div className="flex flex-col gap-3 pt-2">
                  <button 
                    type="submit"
                    className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg"
                  >
                    Unlock Dashboard
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowLoginModal(false)}
                    className="w-full text-slate-400 py-2 text-sm font-bold hover:text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
            <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Metabev Internal Use Only</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
