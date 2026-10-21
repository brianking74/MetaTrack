
import React, { useState, useEffect, useCallback } from 'react';
import { EXPENSE_CURRENCIES, fxRateText, EXPENSE_CURRENCY } from '../constants.ts';
import { fxRatesService, CompanyRates, FxRateInfo } from '../services/fx.ts';

/**
 * Admin Hub -> FX Rates tab.
 *
 * The company exchange rate table is the ONLY source a staff claim can
 * use: every currency row is editable here, "Fetch Latest Rates" prefills
 * the fields from open.er-api.com (free reference feed, no API key) and
 * nothing is stored until "Save Rates" is pressed. Rates are shown to
 * staff read-only and are frozen into each claim at submission, so
 * changing a rate never rewrites history.
 */
interface AdminFxRatesProps {
  currentUserEmail: string;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500';

const AdminFxRates: React.FC<AdminFxRatesProps> = ({ currentUserEmail }) => {
  const [rates, setRates] = useState<CompanyRates | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setMsg(null);
    const { rates: loaded, tableMissing: missing, error } = await fxRatesService.getRates();
    if (missing) {
      setTableMissing(true);
      setRates(null);
    } else if (error) {
      setTableMissing(false);
      setRates(null);
      setMsg({ ok: false, text: `${error} Press "Retry" once the connection is back.` });
    } else {
      setTableMissing(false);
      const clean: CompanyRates = loaded || {};
      setRates(clean);
      setDraft(Object.fromEntries(
        Object.entries(clean).map(([code, info]) => [code, fxRateText(info.rate)])
      ));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const foreignCodes = EXPENSE_CURRENCIES.filter(c => c.code !== EXPENSE_CURRENCY).map(c => c.code);

  /** Prefill the editable fields from the free reference feed (never saves). */
  const handleFetchLatest = async () => {
    setIsFetching(true);
    setMsg(null);
    const { rates: latest, sourceUpdatedAt, error } = await fxRatesService.fetchLatest(foreignCodes);
    setIsFetching(false);
    if (error) {
      setMsg({ ok: false, text: error });
      return;
    }
    const count = Object.keys(latest).length;
    if (!count) {
      setMsg({ ok: false, text: 'The rate service did not return any of our currencies. Try again later or type the rates manually.' });
      return;
    }
    setDraft(prev => {
      const next = { ...prev };
      for (const [code, rate] of Object.entries(latest)) next[code] = fxRateText(rate);
      return next;
    });
    setMsg({
      ok: true,
      text: `${count} rates prefilled from open.er-api.com${sourceUpdatedAt ? ` (source rates last updated ${sourceUpdatedAt})` : ''}. Review the figures - they are raw market reference rates with no company margin - then press Save Rates. Nothing is saved yet.`
    });
  };

  const handleSave = async () => {
    if (!rates) return;
    setMsg(null);
    // HKD is the reporting currency and must stay 1 - ignore it.
    const changes: Record<string, number> = {};
    for (const code of foreignCodes) {
      const raw = (draft[code] ?? '').trim();
      if (!raw) continue;                       // untouched / empty = keep stored value
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) {
        setMsg({ ok: false, text: `${code}: "${raw}" is not a valid rate. Enter a number greater than 0 (HKD per 1 ${code}), or clear the field to keep the current rate.` });
        return;
      }
      if (Math.abs(value - (rates[code]?.rate ?? 0)) > 1e-9) changes[code] = value;
    }
    if (!Object.keys(changes).length) {
      setMsg({ ok: true, text: 'No changes to save - the fields already match the stored company rates.' });
      return;
    }
    setIsSaving(true);
    const res = await fxRatesService.saveRates(changes, currentUserEmail);
    setIsSaving(false);
    if (!res.success) {
      setMsg({ ok: false, text: res.error || 'Could not save the rates.' });
      return;
    }
    // Reload first (syncs the draft with what is now stored), THEN show the
    // confirmation - load() clears messages, so the order matters.
    await load();
    setMsg({ ok: true, text: `Saved ${res.saved} rate${(res.saved || 0) > 1 ? 's' : ''}. Every new foreign-currency claim now uses these figures - existing claims keep the rate they were submitted at.` });
  };

  // ---- Render ----
  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border p-12 text-center">
        <p className="text-sm font-bold text-slate-400">Loading company exchange rates...</p>
      </div>
    );
  }

  if (tableMissing) {
    return (
      <div className="bg-white rounded-3xl border p-12 text-center">
        <p className="text-sm font-bold text-slate-600">The company exchange-rate table does not exist yet.</p>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">Ask your administrator to run <span className="font-mono font-bold">supabase/add_fx_rates.sql</span> in the Supabase SQL Editor (takes a second, safe, idempotent). Until then the claim form keeps its old manual rate field.</p>
      </div>
    );
  }

  if (!rates) {
    return (
      <div className="bg-white rounded-3xl border p-12 text-center">
        <p className="text-sm font-bold text-slate-600 mb-4">Company exchange rates could not be loaded.</p>
        <button onClick={load} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black">Retry</button>
      </div>
    );
  }

  const seededCount = foreignCodes.filter(code => rates[code]?.seeded).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-xl border p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-800">Company Exchange Rates</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              The ONLY rates staff can claim at. 1 unit of the currency = this many HKD.
              Rates are frozen into each claim at submission, so changing a rate never rewrites history.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              onClick={handleFetchLatest}
              disabled={isFetching}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors ${isFetching ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-900 hover:text-slate-900'}`}
            >
              {isFetching ? 'Fetching...' : 'Fetch Latest Rates'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors ${isSaving ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'}`}
            >
              {isSaving ? 'Saving...' : 'Save Rates'}
            </button>
          </div>
        </div>

        {seededCount > 0 && (
          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs font-black text-amber-700 leading-relaxed">
              {seededCount} of {foreignCodes.length} rates are still the setup-script defaults (marked "company default" below).
              Press <span className="underline">Fetch Latest Rates</span> to prefill today's reference figures, adjust if your finance policy differs, then Save Rates.
            </p>
          </div>
        )}

        {msg && (
          <div className={`mt-4 rounded-2xl px-4 py-3 text-xs font-bold leading-relaxed ${msg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {msg.text}
          </div>
        )}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Currency</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate (HKD per 1 unit)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {EXPENSE_CURRENCIES.map(({ code, label }) => {
                const info: FxRateInfo | undefined = rates[code];
                const isBase = code === EXPENSE_CURRENCY;
                return (
                  <tr key={code} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <p className="text-sm font-black text-slate-800">{code}</p>
                      <p className="text-[11px] text-slate-400">{label.split(' - ')[1] || label}</p>
                    </td>
                    <td className="px-4 py-4">
                      {isBase ? (
                        <span className="text-sm font-bold text-slate-400">1.000000 (reporting currency)</span>
                      ) : (
                        <input
                          type="number"
                          min="0.000001"
                          step="0.000001"
                          value={draft[code] ?? ''}
                          onChange={(e) => setDraft(prev => ({ ...prev, [code]: e.target.value }))}
                          placeholder={info ? String(info.rate) : 'not set'}
                          className={`${inputClass} max-w-[220px]`}
                        />
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {!info ? (
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Not set</span>
                      ) : info.seeded ? (
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Company default - review please</span>
                      ) : (
                        <div className="text-xs font-bold text-slate-500 leading-relaxed">
                          {info.updatedAt && (
                            <p>{new Date(info.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          )}
                          {info.updatedBy && <p className="text-[10px] text-slate-400 font-medium normal-case">by {info.updatedBy}</p>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-3xl border p-6">
        <p className="text-xs font-bold text-slate-500 leading-relaxed">
          <span className="font-black text-slate-700 uppercase tracking-widest">How rates reach a claim:</span>{' '}
          staff pick a currency and the form shows the company rate read-only; the HKD value (amount × rate) is frozen into the claim when they submit.
          Managers, the GM, finance emails and the dashboard all total that frozen figure, so a later rate change affects new claims only.
          "Fetch Latest Rates" uses open.er-api.com (free daily reference rates - XE.com's API is a paid product); you can always type figures manually instead.
        </p>
      </div>
    </div>
  );
};

export default AdminFxRates;
