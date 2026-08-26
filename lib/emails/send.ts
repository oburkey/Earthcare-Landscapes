// Sends the scheduled report emails via Resend, using the same FROM address
// and client as lib/email.ts (kept separate since these are triggered by a
// cron job / admin action rather than the invite flow).

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM ?? 'Earthcare Landscapes <noreply@earthcare.net.au>'

export async function getScheduleEmailRecipients(reportType: 'weekly' | 'monthly'): Promise<string[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('email_recipients')
    .select('email')
    .in('email_type', [reportType, 'both'])
    .order('email', { ascending: true })
  if (error) {
    console.error(`[emails/send] Failed to fetch ${reportType} recipients:`, error.message)
    return []
  }
  const emails = (data ?? []).map((r: { email: string }) => r.email)
  console.log(`[emails/send] Fetched ${emails.length} ${reportType} recipient(s).`)
  return emails
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
  if (to.length === 0) {
    console.warn(`[emails/send] No recipients — skipping Resend.send() for "${subject}".`)
    return {}
  }

  console.log(`[emails/send] Calling Resend.send() for ${to.length} recipient(s) — "${subject}".`)
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  })

  if (error) {
    console.error('[emails/send] Resend.send() failed:', error.message)
    return { error: error.message }
  }
  console.log('[emails/send] Resend.send() succeeded.')
  return {}
}
