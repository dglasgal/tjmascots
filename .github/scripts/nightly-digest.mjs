/**
 * Nightly digest — queries Supabase for rows added in the last ~24h
 * from the `submissions` and `corrections` tables, and emails a summary
 * to DIGEST_TO via Resend. Runs on GitHub Actions on a cron schedule.
 */

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY,
  DIGEST_TO,
} = process.env;

for (const [k, v] of Object.entries({
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY,
  DIGEST_TO,
})) {
  if (!v) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

// Look back 26 hours (slight overlap protects against clock skew between runs).
const sinceIso = new Date(Date.now() - 26 * 3600 * 1000).toISOString();

async function fetchRecent(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?created_at=gte.${sinceIso}&order=created_at.desc`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase fetch ${table} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

const [submissions, corrections] = await Promise.all([
  fetchRecent('submissions'),
  fetchRecent('corrections'),
]);

console.log(
  `Found ${submissions.length} new submissions, ${corrections.length} new corrections since ${sinceIso}`,
);

if (submissions.length === 0 && corrections.length === 0) {
  console.log('Nothing new today. Skipping email so your inbox stays clean.');
  process.exit(0);
}

// --- HTML escaping helper ---
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );

// --- Row builders ---
function submissionRow(s) {
  return `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:10px 12px;vertical-align:top;"><strong>${esc(s.name || 'Unnamed')}</strong><br><span style="color:#6B5B45;font-size:13px;">${esc(s.animal || '?')}</span></td>
      <td style="padding:10px 12px;vertical-align:top;">${esc(s.store)}</td>
      <td style="padding:10px 12px;vertical-align:top;color:#6B5B45;">${esc(s.notes || '—')}</td>
      <td style="padding:10px 12px;vertical-align:top;">${s.photo_path ? '📎 photo attached' : '—'}</td>
      <td style="padding:10px 12px;vertical-align:top;color:#6B5B45;font-size:12px;">${esc(s.email || '')}</td>
    </tr>
  `;
}

function correctionRow(c) {
  const issues = Array.isArray(c.issues) ? c.issues.join(', ') : '';
  return `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:10px 12px;vertical-align:top;"><strong>${esc(c.mascot_name || `id ${c.mascot_id}`)}</strong></td>
      <td style="padding:10px 12px;vertical-align:top;">${esc(c.store)}</td>
      <td style="padding:10px 12px;vertical-align:top;"><span style="background:#FDECEC;color:#C8102E;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:700;">${esc(issues)}</span></td>
      <td style="padding:10px 12px;vertical-align:top;color:#6B5B45;">${esc(c.details || '—')}</td>
      <td style="padding:10px 12px;vertical-align:top;color:#6B5B45;font-size:12px;">${esc(c.reporter_email || '')}</td>
    </tr>
  `;
}

const supabaseProjectId = new URL(SUPABASE_URL).host.split('.')[0];
const dashLink = `https://supabase.com/dashboard/project/${supabaseProjectId}/editor`;

const html = `
<!doctype html>
<html>
<body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#3A2E1F;background:#FDF6EC;margin:0;padding:0;">
  <div style="max-width:760px;margin:0 auto;padding:28px 24px;">
    <h1 style="color:#C8102E;margin:0 0 4px 0;font-size:28px;">🛒 TJ Mascots — nightly digest</h1>
    <p style="color:#6B5B45;margin:0 0 28px 0;">New activity in the last 24 hours.</p>

    <h2 style="margin:24px 0 10px 0;font-size:18px;">📥 New mascot submissions (${submissions.length})</h2>
    ${
      submissions.length === 0
        ? '<p style="color:#999;margin:0;">None.</p>'
        : `<table style="width:100%;border-collapse:collapse;background:#fff;border-top:3px solid #C8102E;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#FDF6EC;text-align:left;">
                <th style="padding:10px 12px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#6B5B45;">Mascot</th>
                <th style="padding:10px 12px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#6B5B45;">Store</th>
                <th style="padding:10px 12px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#6B5B45;">Notes</th>
                <th style="padding:10px 12px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#6B5B45;">Photo</th>
                <th style="padding:10px 12px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#6B5B45;">Reporter</th>
              </tr>
            </thead>
            <tbody>${submissions.map(submissionRow).join('')}</tbody>
          </table>`
    }

    <h2 style="margin:32px 0 10px 0;font-size:18px;">⚠︎ Reported corrections (${corrections.length})</h2>
    ${
      corrections.length === 0
        ? '<p style="color:#999;margin:0;">None.</p>'
        : `<table style="width:100%;border-collapse:collapse;background:#fff;border-top:3px solid #C8102E;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#FDF6EC;text-align:left;">
                <th style="padding:10px 12px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#6B5B45;">Mascot</th>
                <th style="padding:10px 12px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#6B5B45;">Store</th>
                <th style="padding:10px 12px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#6B5B45;">Issues</th>
                <th style="padding:10px 12px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#6B5B45;">Details</th>
                <th style="padding:10px 12px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#6B5B45;">Reporter</th>
              </tr>
            </thead>
            <tbody>${corrections.map(correctionRow).join('')}</tbody>
          </table>`
    }

    <p style="margin:36px 0 0 0;color:#6B5B45;font-size:13px;">
      Review in the <a href="${dashLink}" style="color:#C8102E;font-weight:700;">Supabase table editor</a> to mark them resolved.
    </p>
    <p style="margin:6px 0 0 0;color:#ccc;font-size:11px;">
      Sent by the TJ Mascots nightly digest job. If this is noisy you can change the schedule in .github/workflows/nightly-digest.yml.
    </p>
  </div>
</body>
</html>
`;

const subject = `TJ Mascots digest — ${submissions.length} submission${
  submissions.length === 1 ? '' : 's'
}, ${corrections.length} correction${corrections.length === 1 ? '' : 's'}`;

const resendRes = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'TJ Mascots <onboarding@resend.dev>',
    to: [DIGEST_TO],
    subject,
    html,
  }),
});

if (!resendRes.ok) {
  const errText = await resendRes.text();
  console.error('Resend API error:', resendRes.status, errText);
  process.exit(1);
}

const body = await resendRes.json();
console.log(`Digest sent! Resend id: ${body.id || '(none)'}`);
