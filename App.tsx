
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import AssessmentForm from './components/AssessmentForm.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import { Assessment, Role } from './types.ts';

const App: React.FC = () => {
  const [role, setRole] = useState<Role>('employee');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeDraft, setActiveDraft] = useState<Assessment | undefined>();

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

  const handleRoleSwitch = () => {
    setRole(prev => prev === 'employee' ? 'admin' : 'employee');
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
    alert("Assessment submitted successfully for review!");
  };

  const handleAdminReviewComplete = (updated: Assessment) => {
    setAssessments(prev => prev.map(a => a.id === updated.id ? updated : a));
    alert(`Review for ${updated.employeeDetails.fullName} completed.`);
  };

  // For demo, we consider the "current" view based on if anything is submitted
  const hasSubmitted = assessments.some(a => a.status !== 'draft');

  return (
    <Layout 
      title={role === 'employee' ? 'Staff Assessment Form' : 'Assessor Review Hub'} 
      role={role} 
      onRoleSwitch={handleRoleSwitch}
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
            <div className="max-w-2xl mx-auto text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Form Submitted</h3>
              <p className="text-slate-500 mb-8">Your performance appraisal has been successfully submitted.<br/> An assessor will review your input and finalize the evaluation.</p>
              <div className="inline-flex gap-4">
                 <button 
                  onClick={() => {
                    const ok = confirm("Are you sure you want to clear your submission and start a fresh form? This action cannot be undone.");
                    if(ok) {
                      setAssessments([]);
                      setActiveDraft(undefined);
                    }
                  }}
                  className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                 >
                   Start New Form
                 </button>
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
  );
};

export default App;
