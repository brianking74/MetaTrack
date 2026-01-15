
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
        if (error.code === '42P01') return { success: false, error: 'Table "assessments" not found. Please run the updated SQL script.' };
        if (error.code === 'PGRST204') return { success: false, error: 'Database schema cache is stale. Run the SQL script again to refresh it.' };
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
        // If we get a column error, suggest the fix
        if (error.message.includes('updated_at')) {
          return { success: false, error: 'Column "updated_at" missing in database. Please run the "Clean Reset" SQL script in Supabase.' };
        }
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
