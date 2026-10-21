
import { supabase } from './supabase.ts';

// ============================================================
// Company FX rates service
// ============================================================
// DB table : public.expense_fx_rates  (RLS: all signed-in users read,
//            ONLY admin@metabev.com writes - see add_fx_rates.sql)
// Semantics: one row per currency, rate = "HKD per 1 unit of the
//            currency". The claim form shows these rates read-only and
//            freezes the rate into each claim at submission, so later
//            rate changes never rewrite history.
// Live feed : "Fetch Latest Rates" in the Admin Hub pulls reference
//            rates from open.er-api.com (free, no API key, CORS
//            enabled, updated daily). XE.com's API is a paid product,
//            so this free ECB-style feed is used as the prefill source
//            instead - the administrator always reviews before saving.

export const FX_TABLE = 'expense_fx_rates';

export interface FxRateInfo {
  rate: number;        // HKD per 1 unit of the currency
  updatedBy?: string;  // admin email, or 'seed' for setup-script defaults
  updatedAt?: string;  // ISO timestamp of the last save
  seeded?: boolean;    // true = company default from the SQL setup script
}

export type CompanyRates = Record<string, FxRateInfo>;

const networkError = (err: any, fallback: string) =>
  err?.message === 'Failed to fetch'
    ? 'Network Error: Connection to Database failed. Please check if your Supabase project is paused or if you are offline.'
    : (err?.message || fallback);

/** True when the expense_fx_rates table has not been created yet
 *  (PostgREST signals a missing table as PGRST205 / "Could not find"). */
const isMissingTable = (err: any): boolean => {
  const msg = String(err?.message || '');
  return err?.code === 'PGRST205' || msg.includes('Could not find the table') || msg.includes('does not exist');
};

export const fxRatesService = {
  /** All company rates keyed by currency code. rates = null means the
   *  table could not be read; tableMissing lets the UI fall back to the
   *  pre-rates behaviour (manual entry) until the SQL script is run. */
  async getRates(): Promise<{ rates: CompanyRates | null; tableMissing?: boolean; error?: string }> {
    if (!supabase) return { rates: null, error: 'Supabase is not configured.' };
    try {
      const { data, error } = await supabase
        .from(FX_TABLE)
        .select('currency, rate, updated_by, updated_at');
      if (error) throw error;
      const rates: CompanyRates = {};
      for (const row of data || []) {
        const code = String(row.currency || '').toUpperCase();
        const rate = Number(row.rate);
        if (!code || !Number.isFinite(rate) || rate <= 0) continue;
        const updatedBy = row.updated_by || '';
        rates[code] = {
          rate,
          updatedBy,
          updatedAt: row.updated_at || undefined,
          seeded: updatedBy === 'seed'
        };
      }
      return { rates };
    } catch (err: any) {
      if (isMissingTable(err)) return { rates: null, tableMissing: true };
      return { rates: null, error: networkError(err, 'Could not load company exchange rates.') };
    }
  },

  /** Admin-only: save rates (HKD per 1 unit). RLS rejects non-admins. */
  async saveRates(updates: Record<string, number>, updatedBy: string): Promise<{ success: boolean; saved?: number; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase is not configured.' };
    const entries = Object.entries(updates)
      .map(([code, rate]) => [code.toUpperCase(), Number(rate)] as [string, number])
      .filter(([, rate]) => Number.isFinite(rate) && rate > 0);
    if (!entries.length) return { success: false, error: 'No valid rates to save.' };

    const payload = entries.map(([currency, rate]) => ({
      currency,
      rate: Math.round(rate * 1e6) / 1e6,
      updated_by: (updatedBy || '').toLowerCase().trim(),
      updated_at: new Date().toISOString()
    }));

    try {
      const { error } = await supabase
        .from(FX_TABLE)
        .upsert(payload, { onConflict: 'currency' });
      if (error) throw error;
      return { success: true, saved: payload.length };
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('row-level security') || msg.includes('permission')) {
        return { success: false, error: 'The database rejected the save - only admin@metabev.com can change company rates.' };
      }
      return { success: false, error: networkError(err, 'Could not save the rates.') };
    }
  },

  /**
   * Live reference rates from open.er-api.com (base HKD) as a PREFILL
   * for the Admin Hub: the API returns "1 HKD = X <currency>", so we
   * invert to the portal's "HKD per 1 unit" convention. Nothing is
   * saved until the administrator clicks Save Rates.
   */
  async fetchLatest(codes: string[]): Promise<{ rates: Record<string, number>; sourceUpdatedAt?: string; error?: string }> {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/HKD');
      if (!res.ok) return { rates: {}, error: `The rate service responded with HTTP ${res.status}. Try again in a moment - you can still type the rates manually.` };
      const body = await res.json();
      if (body?.result !== 'success' || !body?.rates) {
        return { rates: {}, error: 'The rate service returned an unexpected response. Try again in a moment - you can still type the rates manually.' };
      }
      const out: Record<string, number> = {};
      for (const code of codes) {
        const perHkd = Number(body.rates[code]);   // 1 HKD = perHkd <code>
        if (perHkd > 0) out[code] = Math.round((1 / perHkd) * 1e6) / 1e6;
      }
      return { rates: out, sourceUpdatedAt: body.time_last_update_utc || undefined };
    } catch {
      return { rates: {}, error: 'Could not reach the rate service (open.er-api.com). Check your connection and try again - you can still type the rates manually.' };
    }
  }
};
