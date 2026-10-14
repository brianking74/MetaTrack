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
//   { "event": "submitted" | "approved" | "rejected", "claim": {...} }

const PORTAL_URL = 'https://performance-review.netlify.app';

const money = (c) =>
  new Intl.NumberFormat('en-HK', { style: 'currency', currency: c.currency || 'HKD' }).format(c.amount);

const row = (label, value) =>
  `<tr><td style="padding:6px 14px 6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:700">${label}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600">${value}</td></tr>`;

const claimTable = (claim) =>
  `<table style="border-collapse:collapse;margin:18px 0">${row('Staff', claim.staffName)}
  ${row('Type', (claim.expenseType || ''))}
  ${row('Expense date', claim.expenseDate)}
  ${row('Description', claim.description)}
  ${row('Amount', money(claim))}</table>`;

function buildEmail(event, claim, financeEmail) {
  if (event === 'submitted') {
    return {
      to: [claim.managerEmail],
      subject: `Expense claim awaiting your approval - ${claim.staffName} (${money(claim)})`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px">
        <p style="color:#0f172a;font-size:15px">Hello${claim.managerName ? ' ' + claim.managerName : ''},</p>
        <p style="color:#334155;font-size:14px;line-height:1.6"><strong>${claim.staffName}</strong> has submitted an expense claim and is waiting for your approval.</p>
        ${claimTable(claim)}
        <p style="color:#334155;font-size:14px">Please sign in to the portal to review the claim and its receipt:</p>
        <p><a href="${PORTAL_URL}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:12px 26px;border-radius:12px;font-size:12px;font-weight:bold;letter-spacing:.15em;text-transform:uppercase;text-decoration:none">Open Employee Portal</a></p>
        <p style="color:#94a3b8;font-size:11px;margin-top:28px">MetaBev Employee Portal - automated notification. Do not reply.</p>
      </div>`
    };
  }

  if (event === 'approved') {
    const staffMail = {
      to: [claim.email],
      subject: `Your expense claim has been approved (${money(claim)})`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px">
        <p style="color:#0f172a;font-size:15px">Hello ${claim.staffName},</p>
        <p style="color:#334155;font-size:14px;line-height:1.6">Good news - your expense claim has been <strong style="color:#059669">approved</strong>${claim.reviewedBy ? ` by ${claim.reviewedBy}` : ''}.</p>
        ${claimTable(claim)}
        ${claim.reviewComment ? `<p style="color:#334155;font-size:14px">Manager comment: "<em>${claim.reviewComment}</em>"</p>` : ''}
        <p style="color:#334155;font-size:14px">Finance has been notified to process the payment.</p>
        <p style="color:#94a3b8;font-size:11px;margin-top:28px">MetaBev Employee Portal - automated notification. Do not reply.</p>
      </div>`
    };
    const financeMail = financeEmail ? {
      to: [financeEmail],
      subject: `Expense claim approved - payment due to ${claim.staffName} (${money(claim)})`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px">
        <p style="color:#0f172a;font-size:15px">Hello Finance,</p>
        <p style="color:#334155;font-size:14px;line-height:1.6">The following expense claim has been approved and is ready for payment.</p>
        ${claimTable(claim)}
        ${row('Claimant email', claim.email)}
        ${row('Approved by', claim.reviewedBy || '')}
        <p style="color:#94a3b8;font-size:11px;margin-top:28px">MetaBev Employee Portal - automated notification. Do not reply.</p>
      </div>`
    } : null;
    return { staffMail, financeMail };
  }

  // rejected
  return {
    to: [claim.email],
    subject: `Your expense claim was not approved (${money(claim)})`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px">
      <p style="color:#0f172a;font-size:15px">Hello ${claim.staffName},</p>
      <p style="color:#334155;font-size:14px;line-height:1.6">Unfortunately your expense claim was <strong style="color:#dc2626">not approved</strong>.</p>
      ${claimTable(claim)}
      ${claim.reviewComment ? `<p style="color:#334155;font-size:14px">Manager comment: "<em>${claim.reviewComment}</em>"</p>` : ''}
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

  let event, claim;
  try {
    ({ event, claim } = await req.json());
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
    const email = buildEmail(event, claim, financeEmail);
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
