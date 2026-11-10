// Monthly safety review email — active sites whose safety details are overdue
// for review (6+ months since the last review, or never reviewed). Sent only
// when at least one site is overdue (see app/api/send-safety-review-email).

import { createAdminClient } from '@/lib/supabase/admin'
import { isReviewOverdue, perthDateOf } from '@/lib/siteSafety'
import { renderReportEmail, emptyState, escapeHtml } from './render'
import { formatDate, todayInPerth } from './dateUtils'

export type OverdueSite = {
  siteName: string
  lastReviewedAt: string | null
  reviewerName: string | null
}

export async function fetchOverdueSafetySites(): Promise<OverdueSite[]> {
  const db = createAdminClient()
  const today = todayInPerth()

  const [{ data: sites, error: sitesError }, { data: details, error: detailsError }] = await Promise.all([
    db.from('sites').select('id, name').is('completed_at', null).order('name'),
    db.from('site_safety_details').select('site_id, last_reviewed_at, reviewer:profiles!last_reviewed_by(first_name, last_name)'),
  ])
  if (sitesError) throw new Error(`Could not load sites: ${sitesError.message}`)
  if (detailsError) throw new Error(`Could not load site safety details: ${detailsError.message}`)

  const bySite = new Map((details ?? []).map(d => [d.site_id as string, d]))
  const overdue: OverdueSite[] = []
  for (const site of sites ?? []) {
    const row = bySite.get(site.id as string)
    const lastReviewedAt = (row?.last_reviewed_at as string | null | undefined) ?? null
    if (!isReviewOverdue(lastReviewedAt, today)) continue
    const reviewerRaw = row?.reviewer as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null | undefined
    const reviewer = Array.isArray(reviewerRaw) ? reviewerRaw[0] : reviewerRaw
    overdue.push({
      siteName: site.name as string,
      lastReviewedAt,
      reviewerName: reviewer ? `${reviewer.first_name} ${reviewer.last_name}`.trim() : null,
    })
  }
  return overdue
}

export function renderSafetyReviewEmailHtml(sites: OverdueSite[]): string {
  const rows = sites.map(s => {
    const last = s.lastReviewedAt
      ? `Last reviewed ${formatDate(perthDateOf(s.lastReviewedAt))}${s.reviewerName ? ` by ${escapeHtml(s.reviewerName)}` : ''}`
      : 'Never reviewed'
    return `<li style="margin-bottom:6px;"><span style="font-weight:600;color:#b91c1c;">${escapeHtml(s.siteName)}</span>` +
      `<br /><span style="color:#555555;">${last}</span></li>`
  }).join('')

  return renderReportEmail({
    heading: 'Site safety details due for review',
    intro: sites.length === 0
      ? 'No sites are overdue for review.'
      : `${sites.length} site${sites.length === 1 ? '' : 's'} overdue — reviewed more than 6 months ago, or never reviewed.`,
    sections: [{
      title: 'Overdue sites',
      viewInAppHref: '/safety',
      bodyHtml: sites.length === 0
        ? emptyState('No sites are overdue for review.')
        : `<ul style="margin:0;padding-left:18px;">${rows}</ul>` +
          `<p style="margin:12px 0 0;font-size:13px;color:#666666;">Review them in Safety &rarr; Safety Admin &rarr; Site safety details.</p>`,
    }],
  })
}
