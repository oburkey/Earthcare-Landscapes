// Triggered by .github/workflows/weekly-email.yml every Friday 7am Perth time
// (also callable manually — see Settings → Schedule Emails → Send test now).
// Requires a Bearer token matching CRON_SECRET so it can't be triggered by
// anyone who finds the URL. Sends even when there are no issues, so the
// recipients know the check actually ran.

import { NextRequest, NextResponse } from 'next/server'
import { getQuantIssues } from '@/lib/quantIssues'
import { renderIssuesEmailHtml } from '@/lib/emails/issuesTemplate'
import { getScheduleEmailRecipients, sendScheduleEmail } from '@/lib/emails/send'
import { formatDate, todayInPerth } from '@/lib/emails/dateUtils'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const recipients = await getScheduleEmailRecipients('issues')
    console.log(`[send-issues-email] ${recipients.length} recipient(s) for this run.`)
    const issues = await getQuantIssues()
    const html = renderIssuesEmailHtml(issues)

    const { error } = await sendScheduleEmail({
      to: recipients,
      subject: `Quant sheet & invoicing issues — ${formatDate(todayInPerth())}`,
      html,
    })
    if (error) return NextResponse.json({ error }, { status: 500 })

    return NextResponse.json({ success: true, issueCount: issues.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
