
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import AssessmentForm from './components/AssessmentForm.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import { Assessment, RoleType } from './types.ts';
import confetti from 'canvas-confetti';

const ADMIN_PASSWORD = "metabevadmin"; 
const SUPER_ADMIN_EMAIL = "admin@metabev.com";

const App: React.FC = () => {
  const [role, setRole] = useState<RoleType | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [passwordInput, setPasswordInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('metabev-assessments-v2');
    if (saved) setAssessments(JSON.parse(saved));
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('metabev-assessments-v2', JSON.stringify(assessments));
  }, [assessments]);

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.includes("@")) {
      setAuthError("Please enter a valid email.");
      return;
    }
    setCurrentUserEmail(emailInput.trim().toLowerCase());
    setRole('staff');
  };

  const handleAssessorLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput !== ADMIN_PASSWORD) {
      setAuthError("Invalid master password.");
      return;
    }
    const email = emailInput.trim().toLowerCase();
    setCurrentUserEmail(email);
    
    // Super Admin check
    if (email === SUPER_ADMIN_EMAIL) {
      setRole('admin');
    } else {
      setRole('manager');
    }
    setAuthError("");
  };

  const handleLogout = () => {
    setRole(null);
    setCurrentUserEmail("");
    setEmailInput("");
    setPasswordInput("");
    setAuthError("");
  };

  const currentAssessment = assessments.find(a => a.employeeDetails.email.toLowerCase() === currentUserEmail.toLowerCase());

  const handleSaveAssessment = (data: Assessment) => {
    setAssessments(prev => prev.map(a => a.id === data.id ? data : a));
  };

  const handleSubmitAssessment = (data: Assessment) => {
    const submitted = { ...data, status: 'submitted' as const, submittedAt: new Date().toISOString() };
    handleSaveAssessment(submitted);
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  };

  const handleBulkUpload = (newEntries: Assessment[]) => {
    setAssessments(prev => {
      const merged = [...prev];
      newEntries.forEach(entry => {
        const idx = merged.findIndex(m => m.employeeDetails.email.toLowerCase() === entry.employeeDetails.email.toLowerCase());
        if (idx === -1) {
          merged.push(entry);
        } else {
          // If exists, update the pre-filled KPIs but preserve existing state
          merged[idx] = { ...merged[idx], kpis: entry.kpis, managerName: entry.managerName, managerEmail: entry.managerEmail };
        }
      });
      return merged;
    });
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
          <div className="bg-brand-900 md:w-1/2 p-12 flex flex-col justify-between text-white">
            <div>
              <h1 className="text-4xl font-serif tracking-widest mb-2">METABEV</h1>
              <p className="text-xs uppercase tracking-[0.4em] opacity-60">Staff Performance Portal</p>
            </div>
            <div className="space-y-4">
              <p className="text-sm opacity-80 leading-relaxed italic">"Excellence is not a singular act, but a habit. We are what we repeatedly do."</p>
              <div className="h-1 w-12 bg-white/20"></div>
            </div>
          </div>
          <div className="md:w-1/2 p-12 bg-white overflow-y-auto">
            <h2 className="text-2xl font-black text-slate-800 mb-8">Login to Portal</h2>
            <div className="space-y-8">
              <form onSubmit={handleStaffLogin} className="space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">For Employees</span>
                <input 
                  type="email" 
                  placeholder="Your Staff Email"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
                <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg hover:scale-[1.02] transition-all">Staff Access</button>
              </form>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-300">OR</span>
                </div>
              </div>
              
              <form onSubmit={handleAssessorLogin} className="space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">For Assessors</span>
                <input 
                  type="email" 
                  placeholder="Manager Email"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 mb-2"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
                <input 
                  type="password" 
                  placeholder="Master Password"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                />
                <p className="text-[9px] text-slate-400 leading-tight">
                  Tip: Use <span className="font-bold text-slate-600">admin@metabev.com</span> to access CSV upload tools.
                </p>
                <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold shadow-lg hover:scale-[1.02] transition-all">Assessor Hub</button>
              </form>
              {authError && <p className="text-center text-xs font-bold text-red-500">{authError}</p>}
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
    >
      <div className="max-w-7xl mx-auto">
        {role === 'staff' ? (
          currentAssessment ? (
            currentAssessment.status === 'reviewed' ? (
              <div className="bg-white p-12 rounded-3xl shadow-xl text-center">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                   <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="text-3xl font-black mb-4">Review Complete!</h2>
                <p className="text-slate-500 mb-8 max-w-md mx-auto">Your manager has finalized your appraisal. Please contact HR if you wish to see the full physical report.</p>
                <div className="p-6 bg-brand-50 border border-brand-100 rounded-2xl inline-block">
                  <span className="text-xs font-bold text-slate-400 uppercase block mb-2">Final Agreed Rating</span>
                  <span className="text-2xl font-black text-brand-900">{currentAssessment.overallPerformance.managerRating}</span>
                </div>
              </div>
            ) : (
              <AssessmentForm 
                initialData={currentAssessment}
                onSave={handleSaveAssessment}
                onSubmit={handleSubmitAssessment}
              />
            )
          ) : (
            <div className="bg-white p-12 rounded-3xl shadow-xl text-center">
              <h2 className="text-2xl font-black text-slate-800 mb-4">No Assessment Found</h2>
              <p className="text-slate-500">You haven't been assigned an assessment yet. Please contact your manager or HR to be added to the registry.</p>
            </div>
          )
        ) : (
          <AdminDashboard 
            assessments={assessments}
            currentUserEmail={currentUserEmail}
            role={role}
            onReviewComplete={(upd) => setAssessments(prev => prev.map(a => a.id === upd.id ? upd : a))}
            onBulkUpload={handleBulkUpload}
          />
        )}
      </div>
    </Layout>
  );
};

export default App;
