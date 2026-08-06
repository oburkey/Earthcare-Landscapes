// Sends the scheduled report emails via Resend, using the same FROM address
// and client as lib/email.ts (kept separate since these are triggered by a
// cron job / admin action rather than the invite flow).

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM ?? 'Earthcare Landscapes <noreply@earthcare.net.au>'

export async function getScheduleEmailRecipients(): Promise<string[]> {
  const db = createAdminClient()
  const { data } = await db.from('email_recipients').select('email').order('email', { ascending: true })
  return (data ?? []).map((r: { email: string }) => r.email)
}

export async function sendScheduleEmail({
  to,
  subject,
  html,
}: {
  to: string[]
  subject: string
  html: string
}): Promise<{ error?: string }> {
  if (to.length === 0) return {}

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  })

  if (error) return { error: error.message }
  return {}
}
