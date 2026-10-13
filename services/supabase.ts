
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

// Translate raw Auth errors into safe, actionable messages.
// Supabase returns the same generic error for "no such user" and "wrong
// password" on purpose (prevents account enumeration), so we do too.
const mapAuthError = (message: string): string => {
  if (message.includes('Invalid login credentials')) {
    return 'Email or password is incorrect. If your account was just created or the password was reset, contact your administrator.';
  }
  if (message.includes('Email not confirmed')) {
    return 'This account has not been confirmed yet. Contact your administrator.';
  }
  if (message.includes('Too many requests') || message.includes('rate limit')) {
    return 'Too many login attempts. Please wait a minute and try again.';
  }
  return message;
};

// Passwords must never travel back into the database inside the JSON blob.
// (They are removed from the type system in Stage 2, but old records fetched
// from the DB or legacy CSV uploads may still carry them - strip defensively.)
const stripSecrets = (a: Assessment): Assessment => {
  const { managerPassword: _mp, employeePassword: _ep, ...rest } = a as Assessment & Record<string, unknown>;
  return rest as Assessment;
};

export const supabaseService = {
  /** True when a Supabase Auth session exists (or can be restored). */
  async getSession(): Promise<{ email: string | null }> {
    if (!supabase) return { email: null };
    try {
      const { data } = await supabase.auth.getSession();
      return { email: data.session?.user?.email?.toLowerCase() ?? null };
    } catch {
      return { email: null };
    }
  },

  /** Real server-side login. Replaces the old browser-side password checks. */
  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: NOT_CONFIGURED_ERROR };
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password
      });
      if (error) return { success: false, error: mapAuthError(error.message) };
      return { success: true };
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        return { success: false, error: 'Network Error: Cannot reach Supabase. Check your connection or ad-blocker.' };
      }
      return { success: false, error: err.message };
    }
  },

  async signOut(): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch {
      // Signing out must never block the UI.
    }
  },

  /** Fires when this tab (or another tab) signs out, so we can reset the UI. */
  onSignedOut(callback: () => void): () => void {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') callback();
    });
    return () => data.subscription.unsubscribe();
  },

  async checkConnection(): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: NOT_CONFIGURED_ERROR };
    try {
      // Under RLS an anonymous/unauthorised select returns an empty page with
      // no error - that still proves the API is reachable.
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

  /**
   * Returns every row the signed-in user is allowed to see (Row Level
   * Security decides): staff -> own reviews, managers -> their reports,
   * admin -> everything. Anonymous callers get an empty array.
   */
  async getAllAssessments(): Promise<{ data: Assessment[]; error?: string }> {
    if (!supabase) return { data: [], error: NOT_CONFIGURED_ERROR };
    try {
      const { data, error } = await supabase.from('assessments').select('data');
      if (error) throw error;
      return { data: (data || []).map(row => stripSecrets(row.data as Assessment)) };
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
        data: stripSecrets(a),
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
        data: stripSecrets(assessment),
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
