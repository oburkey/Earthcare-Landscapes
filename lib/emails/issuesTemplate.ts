// Weekly quant sheet / invoicing issues email — renders the checks from
// lib/quantIssues.ts, grouped site → stage → lot/extra job, split into
// "not yet invoiced" (fix before billing) and "already invoiced" (check for
// a back-claim) sections.

import { renderReportEmail, emptyState, escapeHtml, type EmailSection } from './render'
import type { QuantIssueRow } from '@/lib/quantIssues'

function getAppUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  return `${base}${path}`
}

function entityUrl(row: QuantIssueRow): string {
  return row.entity_type === 'lot'
    ? getAppUrl(`/sites/${row.site_id}/stages/${row.stage_id}/lots/${row.lot_id}`)
    : getAppUrl(`/sites/${row.site_id}/stages/${row.stage_id}/extra-jobs/${row.lot_id}`)
}

function entityLabel(row: QuantIssueRow): string {
  return row.entity_type === 'lot' ? `Lot ${row.lot_number}` : row.lot_number
}

// Groups rows site → stage → entity (a lot or extra job can have several
// flagged issues — those collapse into one list item with multiple lines).
function groupedHtml(rows: QuantIssueRow[]): string {
  type Entry = { label: string; url: string; issues: string[] }
  const bySite = new Map<string, Map<string, Map<string, Entry>>>()

  for (const row of rows) {
    const siteMap = bySite.get(row.site) ?? new Map<string, Map<string, Entry>>()
    bySite.set(row.site, siteMap)
    const stageMap = siteMap.get(row.stage) ?? new Map<string, Entry>()
    siteMap.set(row.stage, stageMap)
    const entry = stageMap.get(row.lot_id) ?? { label: entityLabel(row), url: entityUrl(row), issues: [] }
    entry.issues.push(row.quote_type ? `[${row.quote_type}] ${row.issue}` : row.issue)
    stageMap.set(row.lot_id, entry)
  }

  let html = ''
  for (const [site, stageMap] of bySite) {
    html += `<p style="margin:14px 0 4px;font-size:13px;font-weight:700;color:#444444;">${escapeHtml(site)}</p>`
    for (const [stage, lotMap] of stageMap) {
      html += `<p style="margin:6px 0 4px;font-size:12px;font-weight:600;color:#666666;">${escapeHtml(stage)}</p>`
      html += `<ul style="margin:0 0 8px;padding-left:18px;">`
      for (const entry of lotMap.values()) {
        html += `<li style="margin-bottom:6px;">` +
          `<a href="${entry.url}" style="color:#15803d;font-weight:600;text-decoration:none;">${escapeHtml(entry.label)}</a>` +
          `<br /><span style="color:#555555;">${entry.issues.map(escapeHtml).join('<br />')}</span>` +
          `</li>`
      }
      html += `</ul>`
    }
  }
  return html
}

export function renderIssuesEmailHtml(issues: QuantIssueRow[]): string {
  const notInvoiced = issues.filter((i) => !i.invoiced)
  const invoiced = issues.filter((i) => i.invoiced)

  const intro = issues.length === 0
    ? 'No issues found this week.'
    : `${issues.length} issue${issues.length === 1 ? '' : 's'} — ${notInvoiced.length} before billing`

  const sections: EmailSection[] = []

  if (issues.length === 0) {
    sections.push({ title: 'Issues', bodyHtml: emptyState('No issues found this week.') })
  } else {
    if (notInvoiced.length > 0) {
      sections.push({ title: 'Not yet invoiced — fix before billing', bodyHtml: groupedHtml(notInvoiced) })
    }
    if (invoiced.length > 0) {
      sections.push({ title: 'Already invoiced — check if a back-claim is needed', bodyHtml: groupedHtml(invoiced) })
    }
  }

  return renderReportEmail({
    heading: 'Quant sheet & invoicing issues',
    intro,
    sections,
  })
}
