// Triggered by .github/workflows/weekly-email.yml every Friday 7am Perth time
// (also callable manually — see Settings → Schedule Emails → Send test now).
// Requires a Bearer token matching CRON_SECRET so it can't be triggered by
// anyone who finds the URL.

import { NextRequest, NextResponse } from 'next/server'
import { fetchWeeklyEmailData } from '@/lib/emails/data'
import { renderWeeklyEmailHtml } from '@/lib/emails/weeklyTemplate'
import { getScheduleEmailRecipients, sendScheduleEmail } from '@/lib/emails/send'
import { formatDate, todayInPerth } from '@/lib/emails/dateUtils'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const recipients = await getScheduleEmailRecipients('weekly')
    console.log(`[send-weekly-email] ${recipients.length} recipient(s) for this run.`)
    const data = await fetchWeeklyEmailData()
    const html = renderWeeklyEmailHtml(data)

    const { error } = await sendScheduleEmail({
      to: recipients,
      subject: `Weekly schedule report — ${formatDate(todayInPerth())}`,
      html,
    })
    if (error) return NextResponse.json({ error }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
