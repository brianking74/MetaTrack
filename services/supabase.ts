
import { createClient } from '@supabase/supabase-js';
import { Assessment } from '../types';

// Replace these with your actual Supabase Project URL and Anon Key from your Project Settings -> API
const SUPABASE_URL = 'https://your-project-url.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const supabaseService = {
  /**
   * Fetch all assessments from the database
   */
  async getAllAssessments(): Promise<Assessment[]> {
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('data');
      
      if (error) {
        console.error('Supabase fetch error:', error.message);
        return [];
      }
      
      return (data || []).map(row => row.data as Assessment);
    } catch (err) {
      console.error('Unexpected Supabase error:', err);
      return [];
    }
  },

  /**
   * Sync a single assessment to the cloud
   */
  async saveAssessment(assessment: Assessment): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('assessments')
        .upsert({ 
          id: assessment.id, // Column 'id' type must be 'text' in Supabase
          email: assessment.employeeDetails.email.toLowerCase(),
          manager_email: assessment.managerEmail.toLowerCase(),
          data: assessment, // Column 'data' type must be 'jsonb' in Supabase
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) {
        console.error('Supabase save error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Unexpected save error:', err);
      return false;
    }
  },

  /**
   * Bulk upload/update assessments
   */
  async bulkSaveAssessments(assessments: Assessment[]): Promise<boolean> {
    try {
      const payload = assessments.map(a => ({
        id: a.id,
        email: a.employeeDetails.email.toLowerCase(),
        manager_email: a.managerEmail.toLowerCase(),
        data: a,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('assessments')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Supabase bulk save error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Unexpected bulk save error:', err);
      return false;
    }
  },

  /**
   * Remove an assessment from the cloud
   */
  async deleteAssessment(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('assessments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Unexpected delete error:', err);
      return false;
    }
  }
};
