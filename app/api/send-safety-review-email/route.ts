// Triggered daily by .github/workflows/monthly-email.yml at 23:00 UTC (7am
// Perth); no-ops unless it's the 1st in Perth (same reason as
// send-monthly-email). Emails the safety review recipients (wants_safety) a
// list of active sites whose safety details are overdue for review — only
// when at least one site is overdue. Requires a Bearer token matching
// CRON_SECRET, and is excluded from the auth middleware.

import { NextRequest, NextResponse } from 'next/server'
import { fetchOverdueSafetySites, renderSafetyReviewEmailHtml } from '@/lib/emails/safetyReview'
import { getScheduleEmailRecipients, sendScheduleEmail } from '@/lib/emails/send'
import { formatDate, todayInPerth } from '@/lib/emails/dateUtils'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = todayInPerth()
  if (!today.endsWith('-01')) {
    return NextResponse.json({ skipped: true })
  }

  try {
    const overdue = await fetchOverdueSafetySites()
    if (overdue.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'No sites overdue for review.' })
    }

    const recipients = await getScheduleEmailRecipients('safety')
    console.log(`[send-safety-review-email] ${overdue.length} overdue site(s), ${recipients.length} recipient(s).`)
    const { error } = await sendScheduleEmail({
      to: recipients,
      subject: `Site safety details due for review — ${formatDate(today)}`,
      html: renderSafetyReviewEmailHtml(overdue),
    })
    if (error) return NextResponse.json({ error }, { status: 500 })

    return NextResponse.json({ success: true, overdueCount: overdue.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
