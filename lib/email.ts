// Server-only — never import from client components.
// Requires RESEND_API_KEY in .env.local and Vercel env vars.
// The FROM address must be from a domain verified in your Resend account.
// Get your API key at: https://resend.com

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM ?? 'Earthcare Landscapes <noreply@earthcare.net.au>'

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
  await resend.emails.send({
    from: FROM,
    to,
    subject: "You've been invited to Earthcare Landscapes",
    html: `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#111827">
  <h1 style="font-size:20px;font-weight:700;margin:0 0 16px">Earthcare Landscapes</h1>
  ${firstName ? `<p style="margin:0 0 8px;color:#374151">Hi ${firstName},</p>` : ''}
  <p style="margin:0 0 8px;color:#374151">
    You've been invited to join the Earthcare Landscapes team as a
    <strong>${roleLabel}</strong>.
  </p>
  <p style="margin:0 0 24px;color:#374151">
    Click the button below to set up your account.
  </p>
  <a href="${inviteUrl}"
     style="display:inline-block;background:#15803d;color:#fff;padding:12px 28px;
            border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
    Accept invitation
  </a>
  <p style="margin:24px 0 4px;color:#9ca3af;font-size:12px">
    This link expires in 7 days. If you weren't expecting this email, you can safely ignore it.
  </p>
  <p style="margin:0;color:#d1d5db;font-size:11px;word-break:break-all">${inviteUrl}</p>
</div>`,
  })
}
