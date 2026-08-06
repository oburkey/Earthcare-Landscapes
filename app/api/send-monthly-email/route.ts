// Triggered daily by .github/workflows/monthly-email.yml at 23:00 UTC (7am
// Perth) — cron has no clean way to express "the 1st in Perth time" directly
// (a fixed UTC hour on day 1 actually lands on the 2nd in AWST/UTC+8), so the
// workflow runs every day and this route no-ops unless it's currently the 1st
// in Perth. Also callable manually — see Settings → Schedule Emails → Send
// test now, which bypasses this check entirely. Requires a Bearer token
// matching CRON_SECRET so it can't be triggered by anyone who finds the URL.

import { NextRequest, NextResponse } from 'next/server'
import { fetchMonthlyEmailData } from '@/lib/emails/data'
import { renderMonthlyEmailHtml } from '@/lib/emails/monthlyTemplate'
import { getScheduleEmailRecipients, sendScheduleEmail } from '@/lib/emails/send'
import { todayInPerth } from '@/lib/emails/dateUtils'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isFirstOfMonthInPerth = todayInPerth().endsWith('-01')
  if (!isFirstOfMonthInPerth) {
    return NextResponse.json({ skipped: true })
  }

  try {
    const recipients = await getScheduleEmailRecipients()
    const data = await fetchMonthlyEmailData()
    const html = renderMonthlyEmailHtml(data)

    const { error } = await sendScheduleEmail({
      to: recipients,
      subject: `Monthly report — ${data.monthLabel}`,
      html,
    })
    if (error) return NextResponse.json({ error }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
