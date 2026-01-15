
import { createClient } from '@supabase/supabase-js';
import { Assessment } from '../types';

/**
 * CONFIGURATION:
 * Credentials for MetaBev Performance Portal.
 */
const SUPABASE_URL = 'https://cgczxefpsrskssibdiec.supabase.co'; 
const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnY3p4ZWZwc3Jza3NzaWJkaWVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzUwMjIsImV4cCI6MjA4Mzk1MTAyMn0.at83gc8t-CmupmaJGyTHMZQgtdafephnBLdZeAntoGI';

const isConfigured = () => {
  return SUPABASE_URL.includes('supabase.co') && 
         SUPABASE_ANON_KEY.length > 50;
};

const supabase = isConfigured() 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const supabaseService = {
  /**
   * Check connection health and configuration
   */
  async checkConnection(): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized. Check your credentials in services/supabase.ts' };
    }
    try {
      const { error } = await supabase.from('assessments').select('id').limit(1);
      if (error) {
        let msg = error.message;
        if (error.code === '42P01') msg = 'Table "assessments" not found. Please run the SQL setup script in Supabase.';
        if (error.code === '42501') msg = 'Permission denied (RLS). Please ensure the "Allow public access" policy is created.';
        return { success: false, error: msg };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown connection error' };
    }
  },

  /**
   * Fetch all assessments from the database
   */
  async getAllAssessments(): Promise<Assessment[]> {
    if (!supabase) return [];
    
    try {
      console.log('[Supabase] Downloading records...');
      const { data, error } = await supabase
        .from('assessments')
        .select('data');
      
      if (error) {
        console.error('[Supabase] Fetch error:', error.message);
        return [];
      }
      
      const results = (data || []).map(row => row.data as Assessment);
      console.log(`[Supabase] Loaded ${results.length} records.`);
      return results;
    } catch (err) {
      console.error('[Supabase] Unexpected fetch error:', err);
      return [];
    }
  },

  /**
   * Bulk upload/update assessments
   */
  async bulkSaveAssessments(assessments: Assessment[]): Promise<{ success: boolean; error?: string; count?: number }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    if (assessments.length === 0) return { success: true, count: 0 };

    try {
      console.log(`[Supabase] Upserting ${assessments.length} records...`);
      const payload = assessments.map(a => ({
        id: a.id,
        email: a.employeeDetails.email.toLowerCase().trim(),
        manager_email: a.managerEmail.toLowerCase().trim(),
        data: a,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('assessments')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('[Supabase] Sync Error details:', error);
        let msg = error.message;
        if (error.code === '42P01') msg = 'Table "assessments" missing. Did you run the SQL script?';
        return { success: false, error: msg };
      }
      
      console.log('[Supabase] Sync Successful.');
      return { success: true, count: assessments.length };
    } catch (err: any) {
      console.error('[Supabase] Fatal Sync Error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Remove an assessment
   */
  async deleteAssessment(id: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase
        .from('assessments')
        .delete()
        .eq('id', id);
      return !error;
    } catch (err) {
      return false;
    }
  }
};
