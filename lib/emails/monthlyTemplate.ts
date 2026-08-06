import { renderReportEmail, emptyState, escapeHtml, type EmailSection } from './render'
import { formatDate } from './dateUtils'
import type { MonthlyEmailData } from './data'

function statTable(rows: [string, string | number][]): string {
  return `<table width="100%" cellpadding="0" cellspacing="0">${
    rows.map(([label, value]) => `
      <tr>
        <td style="padding:6px 8px 6px 0;">${escapeHtml(label)}</td>
        <td align="right" style="padding:6px 0;font-weight:700;">${escapeHtml(String(value))}</td>
      </tr>`).join('')
  }</table>`
}

export function renderMonthlyEmailHtml(data: MonthlyEmailData): string {
  const sections: EmailSection[] = []

  // 1–4. Build & invoicing summary
  sections.push({
    title: 'Build summary',
    viewInAppHref: '/dashboard',
    bodyHtml: statTable([
      ['Lots completed this month', data.lotsCompletedCount],
      ['Currently overdue lots', data.overdueLotsCount],
      ['Currently delayed lots', data.delayedLotsCount],
    ]),
  })

  sections.push({
    title: 'Invoicing',
    viewInAppHref: '/invoices',
    bodyHtml: statTable([
      ['Lots invoiced this month', data.lotsInvoicedCount],
    ]),
  })

  // 5. Safety summary
  const incidentsHtml = data.incidents.length === 0
    ? emptyState('No incidents logged this month.')
    : `<table width="100%" cellpadding="0" cellspacing="0">
        <thead><tr>
          <th align="left" style="padding:6px 8px;font-size:12px;color:#888888;border-bottom:1px solid #e5e5e0;">Date</th>
          <th align="left" style="padding:6px 8px;font-size:12px;color:#888888;border-bottom:1px solid #e5e5e0;">Site</th>
          <th align="left" style="padding:6px 8px;font-size:12px;color:#888888;border-bottom:1px solid #e5e5e0;">Description</th>
        </tr></thead>
        <tbody>${data.incidents.map((i) => `
          <tr>
            <td style="padding:6px 8px;border-bottom:1px solid #f0f0eb;vertical-align:top;">${formatDate(i.date)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f0f0eb;vertical-align:top;">${escapeHtml(i.siteName)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f0f0eb;vertical-align:top;">${escapeHtml(i.description)}</td>
          </tr>`).join('')}</tbody>
      </table>`

  const safetyStats = statTable([
    ['Pre-starts submitted this month', data.preStartsCount],
    ['Toolbox meetings held this month', data.toolboxMeetingsCount],
    ['Outstanding safety form assignments', data.outstandingSafetyFormsCount],
    ...(data.outstandingSwmsCount !== null
      ? ([[`Outstanding SWMS sign-offs`, data.outstandingSwmsCount]] as [string, number][])
      : []),
  ])

  sections.push({
    title: 'Safety',
    viewInAppHref: '/safety',
    bodyHtml: `${safetyStats}<p style="margin:16px 0 6px;font-size:13px;font-weight:700;color:#444444;">Incidents this month</p>${incidentsHtml}`,
  })

  // 7. New staff
  const newStaffHtml = data.newStaff.length === 0
    ? emptyState('No new staff added this month.')
    : `<ul style="margin:0;padding-left:18px;">${data.newStaff.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`
  sections.push({ title: 'New staff', viewInAppHref: '/staff', bodyHtml: newStaffHtml })

  return renderReportEmail({
    heading: `Monthly report — ${data.monthLabel}`,
    intro: 'A summary of build progress, invoicing, and safety across all sites for the month.',
    sections,
  })
}
