
import { createClient } from '@supabase/supabase-js';
import { Assessment } from '../types';

const SUPABASE_URL = 'https://cgczxefpsrskssibdiec.supabase.co'; 
const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnY3p4ZWZwc3Jza3NzaWJkaWVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzUwMjIsImV4cCI6MjA4Mzk1MTAyMn0.at83gc8t-CmupmaJGyTHMZQgtdafephnBLdZeAntoGI';

const isConfigured = () => {
  return SUPABASE_URL.includes('supabase.co') && SUPABASE_ANON_KEY.length > 50;
};

const supabase = isConfigured() ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const supabaseService = {
  async checkConnection(): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase configuration is missing.' };
    try {
      // Test the connection by selecting a single row
      const { error } = await supabase.from('assessments').select('id').limit(1);
      
      if (error) {
        if (error.code === 'PGRST301') return { success: false, error: 'Database project is likely paused or key is invalid.' };
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      // This is where "Failed to fetch" usually originates
      if (err.message === 'Failed to fetch') {
        return { success: false, error: 'Network Error: Cannot reach Supabase. Your project might be paused or blocked by an ad-blocker.' };
      }
      return { success: false, error: err.message };
    }
  },

  async getAllAssessments(): Promise<Assessment[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('assessments').select('data');
      if (error) throw error;
      return (data || []).map(row => row.data as Assessment);
    } catch (err) {
      console.error('[Supabase] Fetch error:', err);
      return [];
    }
  },

  async bulkSaveAssessments(assessments: Assessment[]): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Database not configured' };
    if (assessments.length === 0) return { success: true };

    try {
      const payload = assessments.map(a => ({
        id: a.id,
        email: (a.employeeDetails.email || '').toLowerCase().trim(),
        manager_email: (a.managerEmail || '').toLowerCase().trim(),
        data: a,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('assessments')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('[Supabase] Sync Error:', error);
        return { success: false, error: `${error.code}: ${error.message}` };
      }
      
      return { success: true };
    } catch (err: any) {
      console.error('[Supabase] Fatal Sync Error:', err);
      const userError = err.message === 'Failed to fetch' 
        ? 'Network Error: Connection to Database failed. Please check if your Supabase project is paused or if you are offline.'
        : err.message;
      return { success: false, error: userError };
    }
  },

  async saveAssessment(assessment: Assessment): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Database not configured' };
    
    try {
      const payload = {
        id: assessment.id,
        email: (assessment.employeeDetails.email || '').toLowerCase().trim(),
        manager_email: (assessment.managerEmail || '').toLowerCase().trim(),
        data: assessment,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('assessments')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('[Supabase] Save Error:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteAssessment(id: string): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase.from('assessments').delete().eq('id', id);
    return !error;
  }
};
