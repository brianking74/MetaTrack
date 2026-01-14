
import { createClient } from '@supabase/supabase-js';
import { Assessment } from '../types';

/**
 * CONFIGURATION:
 * Credentials have been updated with provided project details.
 */
const SUPABASE_URL = 'https://cgczxefpsrskssibdiec.supabase.co'; 
const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnY3p4ZWZwc3Jza3NzaWJkaWVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzUwMjIsImV4cCI6MjA4Mzk1MTAyMn0.at83gc8t-CmupmaJGyTHMZQgtdafephnBLdZeAntoGI';

// Internal check to ensure the client is only initialized with valid-looking credentials
const isConfigured = () => {
  return SUPABASE_URL.includes('supabase.co') && 
         SUPABASE_ANON_KEY !== 'your-anon-key' &&
         SUPABASE_ANON_KEY.length > 50; // JWT keys are typically long
};

const supabase = isConfigured() 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const supabaseService = {
  /**
   * Check connection health and configuration
   */
  async checkConnection(): Promise<boolean> {
    if (!supabase) {
      console.error('[Supabase] Configuration Missing or Invalid.');
      return false;
    }
    try {
      // Simple query to verify table access
      const { error } = await supabase.from('assessments').select('id').limit(1);
      if (error) {
        console.error('[Supabase] Connection Error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Supabase] Fatal Connection Error:', err);
      return false;
    }
  },

  /**
   * Fetch all assessments from the database
   */
  async getAllAssessments(): Promise<Assessment[]> {
    if (!supabase) return [];
    
    console.log('[Supabase] Fetching assessments...');
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('data');
      
      if (error) {
        console.error('[Supabase] Fetch error:', error.message);
        return [];
      }
      
      const results = (data || []).map(row => row.data as Assessment);
      console.log(`[Supabase] Successfully loaded ${results.length} records.`);
      return results;
    } catch (err) {
      console.error('[Supabase] Unexpected fetch error:', err);
      return [];
    }
  },

  /**
   * Bulk upload/update assessments
   */
  async bulkSaveAssessments(assessments: Assessment[]): Promise<boolean> {
    if (!supabase) {
      console.warn("Database not configured properly. Cloud sync is inactive.");
      return false;
    }

    console.log(`[Supabase] Syncing ${assessments.length} records...`);
    try {
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
        console.error('[Supabase] Sync Error:', error.message);
        return false;
      }
      
      console.log('[Supabase] Sync Successful.');
      return true;
    } catch (err) {
      console.error('[Supabase] Unexpected sync error:', err);
      return false;
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

      if (error) {
        console.error('[Supabase] Delete error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  }
};
