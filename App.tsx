
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
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
  const [showFullReport, setShowFullReport] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean | null; error?: string }>({ connected: null });
  
  const [staffEmailInput, setStaffEmailInput] = useState("");
  const [assessorEmailInput, setAssessorEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      const health = await supabaseService.checkConnection();
      setDbStatus({ connected: health.success, error: health.error });
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
      console.error("Sync Failed:", result.error);
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
    const success = await syncToCloud(merged);
    if (success) alert("Cloud Sync Successful!");
  };

  const currentAssessment = assessments.find(a => a.employeeDetails.email.toLowerCase() === currentUserEmail.toLowerCase());

  if (isLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><p>Loading Portal...</p></div>;

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
          <div className="bg-brand-900 md:w-1/2 p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <h1 className="text-4xl font-serif tracking-widest mb-2">METABEV</h1>
              <p className="text-xs uppercase tracking-[0.4em] opacity-60">Performance Portal</p>
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${dbStatus.connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Database: {dbStatus.connected ? 'ONLINE' : 'ERROR'}</span>
              </div>
              {dbStatus.error && <p className="text-[9px] text-red-300 mt-2">{dbStatus.error}</p>}
            </div>
          </div>
          <div className="md:w-1/2 p-12">
            <h2 className="text-2xl font-black text-slate-800 mb-8">Login</h2>
            <div className="space-y-10">
              <form onSubmit={handleStaffLogin} className="space-y-4">
                <input type="email" placeholder="Staff Email" className="w-full px-4 py-3 bg-slate-50 border rounded-xl" value={staffEmailInput} onChange={(e) => setStaffEmailInput(e.target.value)} required />
                <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Staff Access</button>
              </form>
              <form onSubmit={handleAssessorLogin} className="space-y-4">
                <input type="email" placeholder="Manager Email" className="w-full px-4 py-3 bg-slate-50 border rounded-xl" value={assessorEmailInput} onChange={(e) => setAssessorEmailInput(e.target.value)} required />
                <input type="password" placeholder="Password" className="w-full px-4 py-3 bg-slate-50 border rounded-xl" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required />
                <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold">Manager Login</button>
              </form>
              {authError && <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl">{authError}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout title={role === 'staff' ? 'Performance Review' : 'Manager Hub'} role={role === 'staff' ? 'employee' : 'admin'} onRoleSwitch={handleLogout} isSyncing={isSyncing}>
      {role === 'staff' ? (
        currentAssessment && <AssessmentForm initialData={currentAssessment} onSave={(d) => { const n = assessments.map(a => a.id === d.id ? d : a); setAssessments(n); syncToCloud(n); }} onSubmit={(d) => { const n = assessments.map(a => a.id === d.id ? {...d, status: 'submitted'} : a); setAssessments(n); syncToCloud(n); confetti(); }} />
      ) : (
        <AdminDashboard assessments={assessments} currentUserEmail={currentUserEmail} role={role} onReviewComplete={(upd) => { const n = assessments.map(a => a.id === upd.id ? upd : a); setAssessments(n); syncToCloud(n); }} onBulkUpload={handleBulkUpload} onDeleteAssessment={(id) => { const n = assessments.filter(a => a.id !== id); setAssessments(n); supabaseService.deleteAssessment(id); }} isSyncing={isSyncing} onForceSync={() => syncToCloud(assessments)} />
      )}
    </Layout>
  );
};

export default App;
