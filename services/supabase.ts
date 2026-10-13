
import { createClient } from '@supabase/supabase-js';
import { Assessment } from '../types';

// Credentials are injected at build time from environment variables
// (Netlify -> Site settings -> Environment variables, or .env.local for dev).
// Never hardcode them here: this file ships to every visitor's browser.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isConfigured = () => {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY && SUPABASE_URL.includes('supabase.co') && SUPABASE_ANON_KEY.length > 50;
};

const supabase = isConfigured() ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!) : null;

const NOT_CONFIGURED_ERROR = 'Supabase environment variables are missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Set them in Netlify -> Site settings -> Environment variables, then redeploy.';

export const supabaseService = {
  async checkConnection(): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: NOT_CONFIGURED_ERROR };
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

  async getAllAssessments(): Promise<{ data: Assessment[]; error?: string }> {
    if (!supabase) return { data: [], error: NOT_CONFIGURED_ERROR };
    try {
      const { data, error } = await supabase.from('assessments').select('data');
      if (error) throw error;
      return { data: (data || []).map(row => row.data as Assessment) };
    } catch (err: any) {
      return { data: [], error: err.message || 'Failed to fetch assessments' };
    }
  },

  async bulkSaveAssessments(assessments: Assessment[]): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: NOT_CONFIGURED_ERROR };
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
        return { success: false, error: `${error.code}: ${error.message}` };
      }

      return { success: true };
    } catch (err: any) {
      const userError = err.message === 'Failed to fetch'
        ? 'Network Error: Connection to Database failed. Please check if your Supabase project is paused or if you are offline.'
        : err.message;
      return { success: false, error: userError };
    }
  },

  async saveAssessment(assessment: Assessment): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: NOT_CONFIGURED_ERROR };

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
      const userError = err.message === 'Failed to fetch'
        ? 'Network Error: Connection to Database failed. Please check if your Supabase project is paused or if you are offline.'
        : err.message;
      return { success: false, error: userError };
    }
  },

  async deleteAssessment(id: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: NOT_CONFIGURED_ERROR };
    const { error } = await supabase.from('assessments').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }
};
