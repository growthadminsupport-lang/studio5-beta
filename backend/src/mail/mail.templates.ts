/**
 * One layout for every GrowTH email: a greeting, short paragraphs, an optional table of
 * details, one clear button, and a footnote saying why the recipient got it. Every message is
 * sent as HTML and as plain text, because some clinic mail systems strip HTML.
 *
 * Inline styles and a table layout on purpose: mail clients (Outlook especially) ignore
 * <style> blocks and modern CSS.
 */

export interface EmailContent {
  /** Shown by most inboxes next to the subject. */
  preheader: string;
  greeting: string;
  paragraphs: string[];
  details?: [label: string, value: string][];
  action?: { label: string; url: string };
  /** Why they received it, and what to do if it was not expected. */
  footnote: string;
}

const BRAND = '#056559';

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const details = c.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border-collapse:collapse;width:100%">${c.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:14px;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const action = c.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:${BRAND}"><a href="${escapeHtml(c.action.url)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px">${escapeHtml(c.action.label)}</a></td></tr></table>
       <p style="margin:0 0 20px;color:#64748b;font-size:12px;line-height:1.5">If the button does not work, copy this address into your browser:<br><a href="${escapeHtml(c.action.url)}" style="color:${BRAND};word-break:break-all">${escapeHtml(c.action.url)}</a></p>`
    : '';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GrowTH</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(c.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${BRAND};padding:20px 28px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.3px">GrowTH<span style="display:block;font-size:12px;font-weight:400;opacity:.85;margin-top:2px">Child growth and development</span></td></tr>
<tr><td style="padding:28px 28px 8px;color:#0f172a;font-size:15px;line-height:1.6">
<p style="margin:0 0 16px">${escapeHtml(c.greeting)}</p>
${c.paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join('')}
${details}${action}
<p style="margin:0 0 4px">Kind regards,<br>The GrowTH team</p>
</td></tr>
<tr><td style="padding:16px 28px 24px;color:#94a3b8;font-size:12px;line-height:1.5;border-top:1px solid #e2e8f0">${escapeHtml(c.footnote)}<br><br>GrowTH, Faculty of Engineering, Khon Kaen University. This is an automated message; replies to this address are not read.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    c.greeting,
    '',
    ...c.paragraphs.flatMap((p) => [p, '']),
    ...(c.details?.length
      ? [...c.details.map(([k, v]) => `${k}: ${v}`), '']
      : []),
    ...(c.action ? [`${c.action.label}: ${c.action.url}`, ''] : []),
    'Kind regards,',
    'The GrowTH team',
    '',
    '--',
    c.footnote,
    'This is an automated message; replies to this address are not read.',
  ].join('\n');

  return { html, text };
}

export function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
}
