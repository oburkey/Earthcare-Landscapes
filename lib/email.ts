// Server-only — never import from client components.
// Requires RESEND_API_KEY in .env.local and Vercel env vars.
// The FROM address must be from a domain verified in your Resend account.

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM ?? 'Earthcare Landscapes <noreply@earthcare.net.au>'

function getLogoUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  return base ? `${base}/earthcare-logo.png` : ''
}

export async function sendInviteEmail({
  to,
  inviteUrl,
  roleLabel,
  firstName,
}: {
  to: string
  inviteUrl: string
  roleLabel: string
  firstName?: string
}): Promise<void> {
  const logoUrl    = getLogoUrl()
  const greeting   = firstName ? `Hi ${firstName},` : 'Hi there,'

  await resend.emails.send({
    from: FROM,
    to,
    subject: "You've been invited to Earthcare Landscapes",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f5f5f0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

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

              <p style="margin:0 0 6px;font-size:16px;color:#1a1a1a;">${greeting}</p>

              <p style="margin:0 0 20px;font-size:15px;color:#444444;line-height:1.6;">
                You've been invited to join the <strong>Earthcare Landscapes</strong> team portal
                as a <strong>${roleLabel}</strong>.
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:#444444;line-height:1.6;">
                Click the button below to set up your account. This link expires in&nbsp;7&nbsp;days.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:8px;background-color:#15803d;">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;
                              color:#ffffff;text-decoration:none;border-radius:8px;
                              background-color:#15803d;letter-spacing:0.01em;">
                      Accept invitation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 28px;font-size:12px;color:#888888;line-height:1.5;">
                If the button doesn't work, copy and paste this link into your browser:<br />
                <a href="${inviteUrl}" style="color:#15803d;word-break:break-all;">${inviteUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #e5e5e0;margin:0 0 24px;" />

              <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.5;">
                If you weren't expecting this invitation, you can safely ignore this email.<br />
                Please do not reply to this email — it is sent from an unmonitored address.
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
</html>`,
  })
}
