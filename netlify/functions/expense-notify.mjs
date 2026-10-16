// ============================================================
// Netlify Function: expense-notify
// ============================================================
// Sends expense-claim email notifications via Resend (resend.com).
// Deployed automatically with the site (netlify/functions/).
//
// Required Netlify environment variables (Site configuration ->
// Environment variables):
//   RESEND_API_KEY  - API key from resend.com (free tier works)
//   FINANCE_EMAIL   - mailbox that gets "please pay this claim" notices
//   MAIL_FROM       - optional, e.g. 'MetaBev Portal <portal@metabev.com>'
//                     (default uses Resend's sandbox sender, which can only
//                     deliver to YOUR OWN resend.com account email until a
//                     domain is verified)
//
// If RESEND_API_KEY is missing the function responds 200 {sent:false}
// and the app carries on silently - in-app status updates always work.
//
// Called by the portal as:
//   POST /.netlify/functions/expense-notify
//   {
//     "event": "submitted" | "approved" | "rejected",
//     "claim": { ...identity/amount fields of the claim... },
//     "items": [ { "expenseType","expenseDate","description","amount" }, ... ],
//     "total": 208.50
//   }
//
// `items` is OPTIONAL and carries the lines of a multi-item claim (one
// "Add More" submission). When present, emails show ONE itemised table
// with a TOTAL row - i.e. ONE email per claim, never one email per item.
// Without `items` the legacy single-claim table is rendered.

const PORTAL_URL = 'https://performance-review.netlify.app';

const TYPE_LABELS = {
  ENT: 'Entertainment & Business Meals',
  TRV: 'Travel & Transport',
  HTL: 'Hotel / Accommodation',
  MEL: 'Meals (Personal / Staff)',
  TEL: 'Telephone & Communication',
  'AP': 'A&P (Advertising & Promotion)',
  MIS: 'Misc / Other'
};

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

const money = (c, amount) =>
  new Intl.NumberFormat('en-HK', { style: 'currency', currency: c.currency || 'HKD' })
    .format(amount ?? c.amount);

const moneyOf = (currency, amount) => {
  try {
    return new Intl.NumberFormat('en-HK', { style: 'currency', currency: currency || 'HKD' }).format(amount);
  } catch {
    return `${currency || 'HKD'} ${Number(amount || 0).toFixed(2)}`;
  }
};

const fxText = (rate) => String(parseFloat(Number(rate ?? 1).toFixed(6)));

/** HKD reporting value of an item (amount x fxRate, rounded like the app). */
const hkdOf = (it) => {
  const amt = Number(it.amount || 0);
  const cur = it.currency || 'HKD';
  if (cur === 'HKD') return amt;
  return Math.round(amt * Number(it.fxRate ?? 1) * 100) / 100;
};

/** Amount cell for an item: HKD always, with "original × rate" under foreign lines. */
const amountCell = (it) => {
  const cur = it.currency || 'HKD';
  if (cur === 'HKD') return moneyOf(cur, it.amount);
  return `${moneyOf(cur, it.amount)} &times; ${fxText(it.fxRate)}<br>` +
    `<span style="color:#64748b;font-size:11px;font-weight:600">= ${moneyOf('HKD', hkdOf(it))} HKD</span>`;
};

/** Muted sub-line for customer / budget code, shown under the description. */
const metaLine = (it) => {
  const customer = (it.customerName || '').trim();
  const budget = (it.budgetCode || '').trim();
  if (!customer && !budget) return '';
  const parts = [customer, budget ? `Budget: ${budget}` : ''].filter(Boolean).join(' \u00b7 ');
  return `<div style="color:#94a3b8;font-size:11px;margin-top:2px">${escapeHtml(parts)}</div>`;
};

const itemsLabel = (claim, items, total) => {
  if (items && items.length) {
    const hkd = total ?? items.reduce((t, it) => t + hkdOf(it), 0);
    return `${items.length} item${items.length === 1 ? '' : 's'}, ${moneyOf('HKD', hkd)}`;
  }
  const cur = claim.currency || 'HKD';
  return cur === 'HKD' ? money(claim) : `${money(claim)} (=${moneyOf('HKD', hkdOf(claim))})`;
};

const row = (label, value) =>
  `<tr><td style="padding:6px 14px 6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:700">${label}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600">${value}</td></tr>`;

const claimTable = (claim) => {
  const cur = claim.currency || 'HKD';
  const customer = (claim.customerName || '').trim();
  const budget = (claim.budgetCode || '').trim();
  return `<table style="border-collapse:collapse;margin:18px 0">${row('Staff', escapeHtml(claim.staffName))}
  ${row('Type', escapeHtml(TYPE_LABELS[claim.expenseType] || claim.expenseType || ''))}
  ${row('Expense date', escapeHtml(claim.expenseDate))}
  ${row('Description', escapeHtml(claim.description))}
  ${customer ? row('Customer', escapeHtml(customer)) : ''}
  ${budget ? row('Budget code', escapeHtml(budget)) : ''}
  ${row('Amount', cur === 'HKD' ? money(claim) : `${money(claim)} &times; ${fxText(claim.fxRate)} = ${moneyOf('HKD', hkdOf(claim))}`)}</table>`;
};

const itemsTable = (claim, items, total) => {
  const body = items.map(it => `
    <tr>
      <td style="padding:8px 12px 8px 0;border-top:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700;white-space:nowrap">${escapeHtml(TYPE_LABELS[it.expenseType] || it.expenseType || '')}</td>
      <td style="padding:8px 12px;border-top:1px solid #e2e8f0;color:#334155;font-size:13px;white-space:nowrap">${escapeHtml(it.expenseDate)}</td>
      <td style="padding:8px 12px;border-top:1px solid #e2e8f0;color:#334155;font-size:13px">${escapeHtml(it.description)}${metaLine(it)}</td>
      <td style="padding:8px 0 8px 12px;border-top:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;white-space:nowrap">${amountCell(it)}</td>
    </tr>`).join('');
  const grand = total ?? items.reduce((t, it) => t + hkdOf(it), 0);
  const totalRow = `
    <tr>
      <td colspan="3" style="padding:10px 12px 2px 0;text-align:right;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Total in HKD &middot; ${items.length} item${items.length === 1 ? '' : 's'}</td>
      <td style="padding:10px 0 2px 12px;text-align:right;color:#0f172a;font-size:15px;font-weight:800;white-space:nowrap">${moneyOf('HKD', grand)}</td>
    </tr>`;
  return `<table style="border-collapse:collapse;margin:18px 0;width:100%">
    <thead><tr>
      <th align="left" style="padding:0 12px 6px 0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Type</th>
      <th align="left" style="padding:0 12px 6px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Date</th>
      <th align="left" style="padding:0 12px 6px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Description</th>
      <th align="right" style="padding:0 0 6px 12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Amount</th>
    </tr></thead>
    <tbody>${body}${totalRow}</tbody>
  </table>`;
};

// Renders the itemised table when `items` is present (multi-item claim),
// otherwise the legacy single-claim table.
const claimBody = (claim, items, total) =>
  items && items.length ? itemsTable(claim, items, total) : claimTable(claim);

function buildEmail(event, claim, financeEmail, items, total) {
  const table = claimBody(claim, items, total);
  const label = itemsLabel(claim, items, total);

  if (event === 'submitted') {
    return {
      to: [claim.managerEmail],
      subject: `Expense claim awaiting your approval - ${claim.staffName} (${label})`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
        <p style="color:#0f172a;font-size:15px">Hello${claim.managerName ? ' ' + escapeHtml(claim.managerName) : ''},</p>
        <p style="color:#334155;font-size:14px;line-height:1.6"><strong>${escapeHtml(claim.staffName)}</strong> has submitted ${items && items.length > 1 ? `an expense claim with <strong>${items.length} items</strong>` : 'an expense claim'} and is waiting for your approval.</p>
        ${table}
        <p style="color:#334155;font-size:14px">Please sign in to the portal to review the claim and its receipts:</p>
        <p><a href="${PORTAL_URL}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:12px 26px;border-radius:12px;font-size:12px;font-weight:bold;letter-spacing:.15em;text-transform:uppercase;text-decoration:none">Open Employee Portal</a></p>
        <p style="color:#94a3b8;font-size:11px;margin-top:28px">MetaBev Employee Portal - automated notification. Do not reply.</p>
      </div>`
    };
  }

  if (event === 'approved') {
    const staffMail = {
      to: [claim.email],
      subject: `Your expense claim has been approved (${label})`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
        <p style="color:#0f172a;font-size:15px">Hello ${escapeHtml(claim.staffName)},</p>
        <p style="color:#334155;font-size:14px;line-height:1.6">Good news - your expense claim has been <strong style="color:#059669">approved</strong>${claim.reviewedBy ? ` by ${escapeHtml(claim.reviewedBy)}` : ''}.</p>
        ${table}
        ${claim.reviewComment ? `<p style="color:#334155;font-size:14px">Manager comment: "<em>${escapeHtml(claim.reviewComment)}</em>"</p>` : ''}
        <p style="color:#334155;font-size:14px">Finance has been notified to process the payment.</p>
        <p style="color:#94a3b8;font-size:11px;margin-top:28px">MetaBev Employee Portal - automated notification. Do not reply.</p>
      </div>`
    };
    const financeMail = financeEmail ? {
      to: [financeEmail],
      subject: `Expense claim approved - payment due to ${claim.staffName} (${label})`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
        <p style="color:#0f172a;font-size:15px">Hello Finance,</p>
        <p style="color:#334155;font-size:14px;line-height:1.6">The following expense claim has been approved and is ready for payment.</p>
        ${table}
        ${row('Claimant', `${escapeHtml(claim.staffName)} (${escapeHtml(claim.email)})`)}
        ${row('Approved by', escapeHtml(claim.reviewedBy || ''))}
        <p style="color:#94a3b8;font-size:11px;margin-top:28px">MetaBev Employee Portal - automated notification. Do not reply.</p>
      </div>`
    } : null;
    return { staffMail, financeMail };
  }

  // rejected
  return {
    to: [claim.email],
    subject: `Your expense claim was not approved (${label})`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
      <p style="color:#0f172a;font-size:15px">Hello ${escapeHtml(claim.staffName)},</p>
      <p style="color:#334155;font-size:14px;line-height:1.6">Unfortunately your expense claim was <strong style="color:#dc2626">not approved</strong>.</p>
      ${table}
      ${claim.reviewComment ? `<p style="color:#334155;font-size:14px">Manager comment: "<em>${escapeHtml(claim.reviewComment)}</em>"</p>` : ''}
      <p style="color:#334155;font-size:14px">If you have questions, please speak with your manager. You may resubmit a corrected claim if appropriate.</p>
      <p style="color:#94a3b8;font-size:11px;margin-top:28px">MetaBev Employee Portal - automated notification. Do not reply.</p>
    </div>`
  };
}

async function sendViaResend(apiKey, mail, from) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: mail.to, subject: mail.subject, html: mail.html })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, body: body.slice(0, 300) };
  }
  return { ok: true, id: (await res.json().catch(() => ({}))).id };
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  let event, claim, items, total;
  try {
    ({ event, claim, items, total } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }
  if (!claim || !['submitted', 'approved', 'rejected'].includes(event)) {
    return new Response(JSON.stringify({ error: 'Expected event + claim' }), { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Not configured - emails are skipped; the portal still works.
    return new Response(JSON.stringify({ sent: false, reason: 'RESEND_API_KEY not configured' }), { status: 200 });
  }

  const from = process.env.MAIL_FROM || 'MetaBev Employee Portal <onboarding@resend.dev>';
  const financeEmail = process.env.FINANCE_EMAIL || '';
  const results = [];

  try {
    const email = buildEmail(event, claim, financeEmail, items, total);
    if (event === 'approved') {
      results.push(await sendViaResend(apiKey, email.staffMail, from));
      if (email.financeMail) results.push(await sendViaResend(apiKey, email.financeMail, from));
    } else {
      results.push(await sendViaResend(apiKey, email, from));
    }
  } catch (err) {
    return new Response(JSON.stringify({ sent: false, reason: String(err) }), { status: 200 });
  }

  const allOk = results.every(r => r.ok);
  return new Response(JSON.stringify({ sent: allOk, results }), { status: 200 });
};
