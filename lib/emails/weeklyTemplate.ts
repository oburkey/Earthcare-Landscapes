import { renderReportEmail, emptyState, escapeHtml, type EmailSection } from './render'
import { formatDate, formatDateTimePerth } from './dateUtils'
import type { WeeklyEmailData } from './data'

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function delayedBadge(): string {
  return `<span style="display:inline-block;margin-left:6px;padding:1px 7px;font-size:11px;font-weight:600;color:#92400e;background-color:#fef3c7;border-radius:9999px;">Delayed</span>`
}

function rowsTable(rows: string[][], headers: string[]): string {
  const head = headers.map((h) => `<th align="left" style="padding:6px 8px;font-size:12px;color:#888888;border-bottom:1px solid #e5e5e0;">${escapeHtml(h)}</th>`).join('')
  const body = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px 8px;border-bottom:1px solid #f0f0eb;vertical-align:top;">${c}</td>`).join('')}</tr>`).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

export function renderWeeklyEmailHtml(data: WeeklyEmailData): string {
  const sections: EmailSection[] = []

  // 1. Lots due next two weeks, grouped by site
  if (data.lotsDue.length === 0) {
    sections.push({ title: 'Lots due — next two weeks', viewInAppHref: '/schedule', bodyHtml: emptyState('No lots due in the next two weeks.') })
  } else {
    const bySite = new Map<string, typeof data.lotsDue>()
    for (const lot of data.lotsDue) {
      if (!bySite.has(lot.siteName)) bySite.set(lot.siteName, [])
      bySite.get(lot.siteName)!.push(lot)
    }
    const groupsHtml = [...bySite.entries()].map(([site, lots]) => {
      const rows = lots.map((l) => [
        `<strong>${escapeHtml(l.lotNumber)}</strong>`,
        escapeHtml(l.homeDesign ?? '—'),
        formatDate(l.dueDate),
        `${escapeHtml(statusLabel(l.status))}${l.delayed ? delayedBadge() : ''}`,
      ])
      return `<p style="margin:14px 0 6px;font-size:13px;font-weight:700;color:#444444;">${escapeHtml(site)}</p>` +
        rowsTable(rows, ['Lot', 'Home Design', 'Due', 'Status'])
    }).join('')
    sections.push({ title: 'Lots due — next two weeks', viewInAppHref: '/schedule', bodyHtml: groupsHtml })
  }

  // 2. Extra jobs due next two weeks
  if (data.extraJobsDue.length === 0) {
    sections.push({ title: 'Extra jobs due — next two weeks', viewInAppHref: '/schedule', bodyHtml: emptyState('No extra jobs due in the next two weeks.') })
  } else {
    const rows = data.extraJobsDue.map((j) => [
      `<strong>${escapeHtml(j.title)}</strong>`,
      escapeHtml(j.siteName),
      formatDate(j.dueDate),
      escapeHtml(statusLabel(j.status)),
    ])
    sections.push({ title: 'Extra jobs due — next two weeks', viewInAppHref: '/schedule', bodyHtml: rowsTable(rows, ['Job', 'Site', 'Due', 'Status']) })
  }

  // 3. New extra jobs added this week
  if (data.newExtraJobs.length === 0) {
    sections.push({ title: 'New extra jobs — added this week', viewInAppHref: '/schedule', bodyHtml: emptyState('No new extra jobs added this week.') })
  } else {
    const rows = data.newExtraJobs.map((j) => [
      `<strong>${escapeHtml(j.title)}</strong>`,
      escapeHtml(j.siteName),
      formatDateTimePerth(j.createdAt),
    ])
    sections.push({ title: 'New extra jobs — added this week', viewInAppHref: '/schedule', bodyHtml: rowsTable(rows, ['Job', 'Site', 'Added']) })
  }

  // 4. Calendar events next two weeks
  if (data.calendarEvents.length === 0) {
    sections.push({ title: 'Calendar events — next two weeks', viewInAppHref: '/schedule', bodyHtml: emptyState('No calendar events in the next two weeks.') })
  } else {
    const rows = data.calendarEvents.map((e) => [
      formatDate(e.eventDate) + (e.endDate && e.endDate !== e.eventDate ? ` – ${formatDate(e.endDate)}` : ''),
      `<strong>${escapeHtml(e.title)}</strong>${e.description ? `<br /><span style="color:#777777;">${escapeHtml(e.description)}</span>` : ''}`,
    ])
    sections.push({ title: 'Calendar events — next two weeks', viewInAppHref: '/schedule', bodyHtml: rowsTable(rows, ['Date', 'Event']) })
  }

  // 5. Overdue lots
  if (data.overdueLots.length === 0) {
    sections.push({ title: 'Overdue lots', viewInAppHref: '/dashboard', bodyHtml: emptyState('No overdue lots.') })
  } else {
    const rows = data.overdueLots.map((l) => [
      `<strong>${escapeHtml(l.lotNumber)}</strong>`,
      escapeHtml(l.siteName),
      formatDate(l.dueDate),
      `<span style="color:#b91c1c;font-weight:600;">${l.daysOverdue} day${l.daysOverdue === 1 ? '' : 's'} overdue</span>`,
    ])
    sections.push({ title: 'Overdue lots', viewInAppHref: '/dashboard', bodyHtml: rowsTable(rows, ['Lot', 'Site', 'Due date', '']) })
  }

  // 6. Delayed lots
  if (data.delayedLots.length === 0) {
    sections.push({ title: 'Delayed lots', viewInAppHref: '/dashboard', bodyHtml: emptyState('No lots currently marked delayed.') })
  } else {
    const rows = data.delayedLots.map((l) => [
      `<strong>${escapeHtml(l.lotNumber)}</strong>`,
      escapeHtml(l.siteName),
      escapeHtml(l.delayReason ?? '—'),
      formatDate(l.expectedCompletionDate),
    ])
    sections.push({ title: 'Delayed lots', viewInAppHref: '/dashboard', bodyHtml: rowsTable(rows, ['Lot', 'Site', 'Reason', 'Expected completion']) })
  }

  // 7–9. Summary counts
  const summaryHtml = `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:6px 8px 6px 0;">Pre-starts submitted this week</td>
        <td align="right" style="padding:6px 0;font-weight:700;">${data.preStartsCount}</td>
      </tr>
      <tr>
        <td style="padding:6px 8px 6px 0;">Lots awaiting admin review for invoicing</td>
        <td align="right" style="padding:6px 0;font-weight:700;">${data.pendingReviewCount}</td>
      </tr>
      <tr>
        <td style="padding:6px 8px 6px 0;">Lots approved for invoicing (not yet invoiced)</td>
        <td align="right" style="padding:6px 0;font-weight:700;">${data.approvedForInvoicingCount}</td>
      </tr>
    </table>`
  sections.push({ title: 'Pre-starts & invoicing', viewInAppHref: '/invoices', bodyHtml: summaryHtml })

  return renderReportEmail({
    heading: 'Weekly schedule report',
    intro: 'Here’s what’s coming up across all sites for the next two weeks.',
    sections,
  })
}
