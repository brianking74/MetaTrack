
import React from 'react';
import { ExpenseClaim } from '../types.ts';
import { claimHkd, formatMoney, fxRateText, isForeignCurrency } from '../constants.ts';

/**
 * Right-aligned amount cell for a claim line: shows the HKD reporting
 * amount, with a small "original × rate" line underneath when the claim
 * was made in a foreign currency. Used by the staff table, the manager
 * review card/history and the admin list so every screen shows totals
 * on the same HKD basis.
 */
const ClaimAmount: React.FC<{ claim: ExpenseClaim }> = ({ claim }) => (
  <div className="text-right">
    <p className="text-sm font-black text-slate-800 whitespace-nowrap">{formatMoney(claimHkd(claim))}</p>
    {isForeignCurrency(claim.currency) && (
      <p className="text-[10px] font-bold text-slate-400 whitespace-nowrap mt-0.5">
        {formatMoney(claim.amount, claim.currency)} &times; {fxRateText(claim.fxRate)}
      </p>
    )}
  </div>
);

export default ClaimAmount;
