// Shared HTML shell for the weekly/monthly schedule report emails.
// Mirrors the visual style already used for invite emails in lib/email.ts —
// same logo treatment, card, and footer — so all outbound mail looks consistent.

function getLogoUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  return base ? `${base}/earthcare-logo.png` : ''
}

function getAppUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  return `${base}${path}`
}

export type EmailSection = {
  title: string
  viewInAppHref?: string
  bodyHtml: string // pre-rendered inner HTML — table rows, list items, or an empty-state message
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function emptyState(message: string): string {
  return `<p style="margin:0;font-size:14px;color:#888888;font-style:italic;">${escapeHtml(message)}</p>`
}

function renderSection(section: EmailSection): string {
  const link = section.viewInAppHref
    ? `<a href="${getAppUrl(section.viewInAppHref)}" style="font-size:13px;font-weight:600;color:#15803d;text-decoration:none;">View in app &rarr;</a>`
    : ''

  return `
    <tr>
      <td style="padding:0 0 28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:10px;">
              <span style="font-size:15px;font-weight:700;color:#1a1a1a;">${escapeHtml(section.title)}</span>
            </td>
            <td align="right" style="padding-bottom:10px;">${link}</td>
          </tr>
        </table>
        <div style="font-size:14px;color:#333333;line-height:1.6;">
          ${section.bodyHtml}
        </div>
      </td>
    </tr>`
}

export function renderReportEmail({
  heading,
  intro,
  sections,
}: {
  heading: string
  intro: string
  sections: EmailSection[]
}): string {
  const logoUrl = getLogoUrl()
  const sectionsHtml = sections.map(renderSection).join(
    '<tr><td style="border-top:1px solid #e5e5e0;padding:0 0 20px;"></td></tr>'
  )

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f5f5f0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:24px;">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="Earthcare Landscapes" height="40" style="display:block;height:40px;width:auto;" />`
                : `<span style="font-size:18px;font-weight:700;color:#1a1a1a;">Earthcare Landscapes</span>`
              }
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:36px 32px;border:1px solid #e5e5e0;">

              <h1 style="margin:0 0 6px;font-size:20px;color:#1a1a1a;">${escapeHtml(heading)}</h1>
              <p style="margin:0 0 28px;font-size:14px;color:#666666;line-height:1.5;">${escapeHtml(intro)}</p>

              <table width="100%" cellpadding="0" cellspacing="0">
                ${sectionsHtml}
              </table>

              <hr style="border:none;border-top:1px solid #e5e5e0;margin:0 0 20px;" />

              <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.5;">
                This is an automated report — please do not reply to this email.
              </p>

            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding-top:28px;">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="Earthcare Landscapes" height="28" style="display:block;height:28px;width:auto;margin-bottom:10px;opacity:0.7;" />`
                : `<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#555555;">Earthcare Landscapes</p>`
              }
              <p style="margin:0;font-size:12px;color:#888888;line-height:1.8;">
                1b Little Howard Street, Fremantle 6160<br />
                M&nbsp;<a href="tel:0401534585" style="color:#888888;text-decoration:none;">0401 534 585</a>
                &nbsp;&nbsp;W&nbsp;<a href="https://www.earthcare.net.au" style="color:#888888;text-decoration:none;">www.earthcare.net.au</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export { escapeHtml }
