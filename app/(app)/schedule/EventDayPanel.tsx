'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate, STATUS_CONFIG, EXTRA_JOB_STATUS_CONFIG } from '@/lib/lotStatus'
import type { LotItem, JobItem, CalendarEvent } from './ScheduleView'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './actions'

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
}

// ── Event form (create & edit) ─────────────────────────────────────────────────

function EventForm({
  day,
  event,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  day: string
  event: CalendarEvent | null
  submitting: boolean
  error: string | null
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-surface-raised p-4 space-y-3 mt-3">
      {event && <input type="hidden" name="id" value={event.id} />}

      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">Title *</label>
        <input
          type="text" name="title" required autoFocus
          defaultValue={event?.title ?? ''}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">Description</label>
        <textarea
          name="description" rows={2}
          defaultValue={event?.description ?? ''}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Date *</label>
          <input
            type="date" name="event_date" required
            defaultValue={event?.eventDate ?? day}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">End date</label>
          <input
            type="date" name="end_date"
            defaultValue={event?.endDate ?? ''}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Start time</label>
          <input
            type="time" name="start_time"
            defaultValue={event?.startTime ?? ''}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">End time</label>
          <input
            type="time" name="end_time"
            defaultValue={event?.endTime ?? ''}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="text-sm text-fg-muted hover:text-fg-secondary transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className="rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2 text-sm font-medium disabled:opacity-50 transition-opacity">
          {submitting ? 'Saving…' : event ? 'Save changes' : 'Add event'}
        </button>
      </div>
    </form>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  day: string
  lots: LotItem[]
  jobs: JobItem[]
  events: CalendarEvent[]
  canCreate: boolean
  userId: string
  isAdmin: boolean
  onClose: () => void
}

type PanelMode = 'view' | 'add' | 'edit'

export default function EventDayPanel({ day, lots, jobs, events, canCreate, userId, isAdmin, onClose }: Props) {
  const router = useRouter()
  const [mode, setMode]             = useState<PanelMode>('view')
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function canEditEvent(ev: CalendarEvent) {
    return isAdmin || ev.createdBy === userId
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await createCalendarEvent(null, new FormData(e.currentTarget))
    setSubmitting(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setMode('view')
      router.refresh()
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await updateCalendarEvent(null, new FormData(e.currentTarget))
    setSubmitting(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setMode('view')
      setEditingEvent(null)
      router.refresh()
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    setSubmitting(true)
    const result = await deleteCalendarEvent(id)
    setSubmitting(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setConfirmDelete(null)
      router.refresh()
    }
  }

  const hasContent = lots.length > 0 || jobs.length > 0 || events.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40 cursor-default"
        onClick={onClose}
        aria-label="Close"
      />

      {/* Panel */}
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-bg border border-border shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-fg">{formatDate(day)}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-fg-muted hover:bg-surface-raised transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-5">

          {/* Lots */}
          {lots.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-2">Lots due</h3>
              <div className="space-y-1.5">
                {lots.map((lot) => {
                  const cfg = STATUS_CONFIG[lot.status] ?? STATUS_CONFIG.not_started
                  return (
                    <Link
                      key={lot.id}
                      href={`/sites/${lot.siteId}/stages/${lot.stageId}/lots/${lot.lotId}`}
                      onClick={onClose}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 hover:bg-surface-raised transition-colors"
                    >
                      <span className="text-sm font-medium text-fg">Lot {lot.lotNumber}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-fg-muted">{lot.siteName}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Extra jobs */}
          {jobs.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-2">Extra jobs</h3>
              <div className="space-y-1.5">
                {jobs.map((job) => {
                  const cfg = EXTRA_JOB_STATUS_CONFIG[job.status] ?? EXTRA_JOB_STATUS_CONFIG.not_started
                  return (
                    <Link
                      key={job.id}
                      href={`/sites/${job.siteId}/stages/${job.stageId}/extra-jobs/${job.id}`}
                      onClick={onClose}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 hover:bg-surface-raised transition-colors"
                    >
                      <span className="text-sm text-fg-secondary truncate">{job.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${cfg.badge}`}>{cfg.label}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Events */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Events</h3>
              {canCreate && mode === 'view' && (
                <button
                  type="button"
                  onClick={() => { setMode('add'); setError(null) }}
                  className="text-xs font-medium text-accent-fg hover:underline"
                >
                  + Add event
                </button>
              )}
            </div>

            {events.length === 0 && mode === 'view' && (
              <p className="text-xs text-fg-muted">No events on this day.</p>
            )}

            <div className="space-y-2">
              {events.map((ev) => {
                const isEditing = mode === 'edit' && editingEvent?.id === ev.id
                const isDeleting = confirmDelete === ev.id
                const canEdit = canEditEvent(ev)

                if (isEditing) {
                  return (
                    <EventForm
                      key={ev.id}
                      day={day}
                      event={ev}
                      submitting={submitting}
                      error={error}
                      onSubmit={handleUpdate}
                      onCancel={() => { setMode('view'); setEditingEvent(null); setError(null) }}
                    />
                  )
                }

                return (
                  <div key={ev.id} className="rounded-xl border border-green-500/60 bg-surface p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-fg">{ev.title}</p>
                        {(ev.startTime || (ev.endDate && ev.endDate !== ev.eventDate)) && (
                          <p className="text-xs text-fg-muted">
                            {ev.startTime && formatTime(ev.startTime)}
                            {ev.startTime && ev.endTime && ` – ${formatTime(ev.endTime)}`}
                            {ev.endDate && ev.endDate !== ev.eventDate && ` · Until ${formatDate(ev.endDate)}`}
                          </p>
                        )}
                        {ev.description && (
                          <p className="text-xs text-fg-muted whitespace-pre-wrap">{ev.description}</p>
                        )}
                        {ev.createdByName && (
                          <p className="text-[10px] text-fg-muted">Added by {ev.createdByName}</p>
                        )}
                      </div>
                      {canEdit && !isDeleting && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => { setEditingEvent(ev); setMode('edit'); setError(null) }}
                            className="text-xs text-fg-muted hover:text-fg-secondary transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(ev.id)}
                            className="text-xs text-red-500 hover:text-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {isDeleting && (
                      <div className="flex items-center gap-3 pt-1 border-t border-border-subtle mt-2">
                        <span className="text-xs text-fg-muted">Delete this event?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(ev.id)}
                          disabled={submitting}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
                        >
                          {submitting ? 'Deleting…' : 'Yes, delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-fg-muted hover:text-fg-secondary transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {mode === 'add' && (
                <EventForm
                  day={day}
                  event={null}
                  submitting={submitting}
                  error={error}
                  onSubmit={handleCreate}
                  onCancel={() => { setMode('view'); setError(null) }}
                />
              )}
            </div>
          </section>

          {!hasContent && mode === 'view' && (
            <p className="text-xs text-fg-muted text-center py-4">Nothing on this day.</p>
          )}
        </div>
      </div>
    </div>
  )
}
