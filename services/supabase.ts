
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
    if (!supabase) return { success: false, error: 'Supabase URL or Key is missing.' };
    try {
      const { error } = await supabase.from('assessments').select('id').limit(1);
      if (error) {
        if (error.code === '42P01') return { success: false, error: 'Table "assessments" not found. Run the SQL script in Supabase.' };
        if (error.code === '42501') return { success: false, error: 'Row Level Security (RLS) error. Please check your Supabase policies.' };
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
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
        email: a.employeeDetails.email.toLowerCase().trim(),
        manager_email: a.managerEmail.toLowerCase().trim(),
        data: a,
        updated_at: new Date().toISOString()
      }));

      console.log('[Supabase] Syncing payload:', payload);

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
      return { success: false, error: err.message };
    }
  },

  async deleteAssessment(id: string): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase.from('assessments').delete().eq('id', id);
    return !error;
  }
};
