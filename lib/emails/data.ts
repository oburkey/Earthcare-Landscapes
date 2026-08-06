// Data queries for the weekly/monthly schedule report emails.
// Uses createAdminClient() (service role, bypasses RLS) — these reports need
// to see everything regardless of who/what triggers them (a GitHub Actions
// cron job has no logged-in user).

import { createAdminClient } from '@/lib/supabase/admin'
import { todayInPerth, addDays, daysBetween, currentMonthBoundsPerth } from './dateUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

// ── Shared types ────────────────────────────────────────────────────────────

export type LotRow = {
  siteName: string
  lotNumber: string
  homeDesign: string | null
  dueDate: string | null
  status: string
  delayed: boolean
}

export type OverdueLotRow = {
  siteName: string
  lotNumber: string
  dueDate: string
  daysOverdue: number
}

export type DelayedLotRow = {
  siteName: string
  lotNumber: string
  delayReason: string | null
  expectedCompletionDate: string | null
}

export type ExtraJobRow = {
  title: string
  siteName: string
  dueDate: string | null
  status: string
}

export type NewExtraJobRow = {
  title: string
  siteName: string
  createdAt: string
}

export type CalendarEventRow = {
  title: string
  description: string | null
  eventDate: string
  endDate: string | null
}

export type IncidentRow = {
  date: string
  siteName: string
  description: string
}

export type WeeklyEmailData = {
  lotsDue: LotRow[]
  extraJobsDue: ExtraJobRow[]
  newExtraJobs: NewExtraJobRow[]
  calendarEvents: CalendarEventRow[]
  overdueLots: OverdueLotRow[]
  delayedLots: DelayedLotRow[]
  preStartsCount: number
  pendingReviewCount: number
  approvedForInvoicingCount: number
}

export type MonthlyEmailData = {
  monthLabel: string
  lotsCompletedCount: number
  lotsInvoicedCount: number
  overdueLotsCount: number
  delayedLotsCount: number
  preStartsCount: number
  incidents: IncidentRow[]
  toolboxMeetingsCount: number
  outstandingSafetyFormsCount: number
  outstandingSwmsCount: number | null // null = couldn't be determined (no swms templates / query failed)
  newStaff: string[]
}

// ── Shared helpers ────────────────────────────────────────────────────────────

// A lot counts as "started" (and so is excluded from the overdue list) once
// any checklist item has been ticked — that's the only reliable started/not
// signal we have that isn't itself the due date.
async function lotIdsWithStartedChecklist(db: Db, lotIds: string[]): Promise<Set<string>> {
  if (lotIds.length === 0) return new Set()
  const { data } = await db
    .from('lot_checklist_items')
    .select('lot_id')
    .eq('completed', true)
    .in('lot_id', lotIds)
  return new Set((data ?? []).map((r: { lot_id: string }) => r.lot_id))
}

function siteName(row: { stages?: { name?: string; sites?: { name?: string } } }): string {
  return row.stages?.sites?.name ?? 'Unknown site'
}

// ── Weekly ────────────────────────────────────────────────────────────────────

export async function fetchWeeklyEmailData(): Promise<WeeklyEmailData> {
  const db: Db = createAdminClient()
  const today = todayInPerth()
  const twoWeeksOut = addDays(today, 14)
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [
    { data: lotsDueRaw },
    { data: extraJobsDueRaw },
    { data: newExtraJobsRaw },
    { data: calendarEventsRaw },
    { data: overdueCandidatesRaw },
    { data: delayedLotsRaw },
    { count: preStartsCount },
    { count: pendingReviewCount },
    { count: approvedForInvoicingCount },
  ] = await Promise.all([
    db.from('lots')
      .select('id, lot_number, home_design, status, due_date, delayed, stages!inner(name, sites!inner(name, completed_at))')
      .not('due_date', 'is', null)
      .gte('due_date', today)
      .lte('due_date', twoWeeksOut)
      .neq('status', 'complete')
      .order('due_date', { ascending: true }),
    db.from('extra_jobs')
      .select('title, due_date, status, stages!inner(name, sites!inner(name, completed_at))')
      .not('due_date', 'is', null)
      .gte('due_date', today)
      .lte('due_date', twoWeeksOut)
      .neq('status', 'complete')
      .order('due_date', { ascending: true }),
    db.from('extra_jobs')
      .select('title, created_at, stages!inner(name, sites!inner(name, completed_at))')
      .gte('created_at', sevenDaysAgoIso)
      .order('created_at', { ascending: false }),
    db.from('calendar_events')
      .select('title, description, event_date, end_date')
      .lte('event_date', twoWeeksOut)
      .order('event_date', { ascending: true }),
    db.from('lots')
      .select('id, lot_number, due_date, stages!inner(name, sites!inner(name, completed_at))')
      .not('due_date', 'is', null)
      .lt('due_date', today)
      .not('status', 'in', '(complete,in_progress)')
      .order('due_date', { ascending: true }),
    db.from('lots')
      .select('lot_number, delay_reason, expected_completion_date, stages!inner(name, sites!inner(name, completed_at))')
      .eq('delayed', true)
      .neq('status', 'complete'),
    db.from('pre_starts')
      .select('id', { count: 'exact', head: true })
      .gte('date', addDays(today, -7)),
    db.from('lots')
      .select('id', { count: 'exact', head: true })
      .eq('pending_review', true),
    db.from('lots')
      .select('id', { count: 'exact', head: true })
      .eq('approved_for_invoicing', true),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isLiveSite = (row: any) => !row.stages?.sites?.completed_at

  const lotsDue: LotRow[] = (lotsDueRaw ?? []).filter(isLiveSite).map((l: {
    lot_number: string; home_design: string | null; status: string; due_date: string; delayed: boolean
    stages: { name: string; sites: { name: string } }
  }) => ({
    siteName: siteName(l),
    lotNumber: l.lot_number,
    homeDesign: l.home_design,
    dueDate: l.due_date,
    status: l.status,
    delayed: l.delayed,
  }))

  const extraJobsDue: ExtraJobRow[] = (extraJobsDueRaw ?? []).filter(isLiveSite).map((j: {
    title: string; due_date: string; status: string; stages: { name: string; sites: { name: string } }
  }) => ({
    title: j.title,
    siteName: siteName(j),
    dueDate: j.due_date,
    status: j.status,
  }))

  const newExtraJobs: NewExtraJobRow[] = (newExtraJobsRaw ?? []).filter(isLiveSite).map((j: {
    title: string; created_at: string; stages: { name: string; sites: { name: string } }
  }) => ({
    title: j.title,
    siteName: siteName(j),
    createdAt: j.created_at,
  }))

  const calendarEvents: CalendarEventRow[] = (calendarEventsRaw ?? [])
    .filter((e: { event_date: string; end_date: string | null }) => (e.end_date ?? e.event_date) >= today)
    .map((e: { title: string; description: string | null; event_date: string; end_date: string | null }) => ({
      title: e.title,
      description: e.description,
      eventDate: e.event_date,
      endDate: e.end_date,
    }))

  const overdueCandidates = (overdueCandidatesRaw ?? []).filter(isLiveSite) as {
    id: string; lot_number: string; due_date: string; stages: { name: string; sites: { name: string } }
  }[]
  const startedLotIds = await lotIdsWithStartedChecklist(db, overdueCandidates.map((l) => l.id))
  const overdueLots: OverdueLotRow[] = overdueCandidates
    .filter((l) => !startedLotIds.has(l.id))
    .map((l) => ({
      siteName: siteName(l),
      lotNumber: l.lot_number,
      dueDate: l.due_date,
      daysOverdue: daysBetween(today, l.due_date),
    }))

  const delayedLots: DelayedLotRow[] = (delayedLotsRaw ?? []).filter(isLiveSite).map((l: {
    lot_number: string; delay_reason: string | null; expected_completion_date: string | null
    stages: { name: string; sites: { name: string } }
  }) => ({
    siteName: siteName(l),
    lotNumber: l.lot_number,
    delayReason: l.delay_reason,
    expectedCompletionDate: l.expected_completion_date,
  }))

  return {
    lotsDue,
    extraJobsDue,
    newExtraJobs,
    calendarEvents,
    overdueLots,
    delayedLots,
    preStartsCount: preStartsCount ?? 0,
    pendingReviewCount: pendingReviewCount ?? 0,
    approvedForInvoicingCount: approvedForInvoicingCount ?? 0,
  }
}

// ── Monthly ───────────────────────────────────────────────────────────────────

export async function fetchMonthlyEmailData(): Promise<MonthlyEmailData> {
  const db: Db = createAdminClient()
  const today = todayInPerth()
  const { start, end, label } = currentMonthBoundsPerth()

  const [
    { count: lotsCompletedCount },
    { data: invoiceRunsRaw },
    { data: overdueCandidatesRaw },
    { count: delayedLotsCount },
    { count: preStartsCount },
    { data: incidentsRaw },
    { count: toolboxMeetingsCount },
    { count: outstandingSafetyFormsCount },
    outstandingSwmsResult,
    { data: newStaffRaw },
  ] = await Promise.all([
    db.from('lots')
      .select('id', { count: 'exact', head: true })
      .eq('build_complete', true)
      .gte('build_completed_at', start)
      .lt('build_completed_at', end),
    db.from('invoice_runs')
      .select('lot_ids')
      .gte('invoiced_at', start)
      .lt('invoiced_at', end),
    db.from('lots')
      .select('id, stages!inner(sites!inner(completed_at))')
      .not('due_date', 'is', null)
      .lt('due_date', today)
      .not('status', 'in', '(complete,in_progress)'),
    db.from('lots')
      .select('id', { count: 'exact', head: true })
      .eq('delayed', true)
      .neq('status', 'complete'),
    db.from('pre_starts')
      .select('id', { count: 'exact', head: true })
      .gte('date', start)
      .lt('date', end),
    db.from('incidents')
      .select('date, description, sites(name)')
      .gte('date', start)
      .lt('date', end)
      .order('date', { ascending: true }),
    db.from('toolbox_meetings')
      .select('id', { count: 'exact', head: true })
      .gte('date', start)
      .lt('date', end),
    db.from('safety_form_assignments')
      .select('id', { count: 'exact', head: true })
      .is('completed_at', null),
    (async () => {
      try {
        const { data, error } = await db
          .from('safety_form_assignments')
          .select('id, safety_form_templates!inner(form_type)')
          .is('completed_at', null)
          .eq('safety_form_templates.form_type', 'swms')
        if (error) return null
        return (data ?? []).length
      } catch {
        return null
      }
    })(),
    db.from('profiles')
      .select('first_name, last_name, created_at')
      .neq('role', 'client')
      .gte('created_at', start)
      .lt('created_at', end),
  ])

  // Distinct lot ids invoiced this month, across all invoice runs in the window.
  const invoicedLotIds = new Set<string>()
  for (const run of (invoiceRunsRaw ?? []) as { lot_ids: string[] | null }[]) {
    for (const id of run.lot_ids ?? []) invoicedLotIds.add(id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isLiveSite = (row: any) => !row.stages?.sites?.completed_at
  const overdueLotsCount = (overdueCandidatesRaw ?? []).filter(isLiveSite).length

  const incidents: IncidentRow[] = (incidentsRaw ?? []).map((i: {
    date: string; description: string; sites: { name: string } | null
  }) => ({
    date: i.date,
    siteName: i.sites?.name ?? 'Unknown site',
    description: i.description,
  }))

  const newStaff = (newStaffRaw ?? []).map((p: { first_name: string; last_name: string }) =>
    `${p.first_name} ${p.last_name}`.trim()
  )

  return {
    monthLabel: label,
    lotsCompletedCount: lotsCompletedCount ?? 0,
    lotsInvoicedCount: invoicedLotIds.size,
    overdueLotsCount,
    delayedLotsCount: delayedLotsCount ?? 0,
    preStartsCount: preStartsCount ?? 0,
    incidents,
    toolboxMeetingsCount: toolboxMeetingsCount ?? 0,
    outstandingSafetyFormsCount: outstandingSafetyFormsCount ?? 0,
    outstandingSwmsCount: outstandingSwmsResult,
    newStaff,
  }
}
