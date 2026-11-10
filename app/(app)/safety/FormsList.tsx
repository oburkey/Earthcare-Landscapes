'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { revokeAssignment } from './forms-actions'
import { downloadSignedPdf, storeSignedPdf } from './signedPdf'
import type { SafetyFormType } from '@/types/database'

// Safety Admin → Forms: every assignment in one list. Status tabs plus
// site / staff member / form / completed-date filters, all combined.

export type AssignmentManagementRow = {
  id: string
  templateId: string
  templateTitle: string
  formType: SafetyFormType
  assignedTo: string
  assigneeName: string
  siteId: string | null
  siteName: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  // Latest completion and its stored signed PDF
  completionId: string | null
  pdfStored: boolean
  pdfError: string | null
}

export type FormStatus = 'pending' | 'completed' | 'overdue'

// Overdue = not completed and the due date (Perth) has passed
export function formStatus(a: AssignmentManagementRow, todayPerth: string): FormStatus {
  if (a.completedAt) return 'completed'
  return a.dueDate && a.dueDate < todayPerth ? 'overdue' : 'pending'
}

// YYYY-MM-DD (a date column) → "10 Nov 2026"
export function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function perthYmd(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Australia/Perth' })
}

const STATUS_TABS: Array<{ id: FormStatus; label: string }> = [
  { id: 'pending',   label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'overdue',   label: 'Overdue' },
]

const STATUS_BADGE: Record<FormStatus, string> = {
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  completed: 'bg-accent-dim text-accent-fg',
  overdue:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const SELECT_CLASS = 'rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-green-600'

interface Props {
  rows: AssignmentManagementRow[]
  todayPerth: string
  isAdmin: boolean
}

export default function FormsList({ rows, todayPerth, isAdmin }: Props) {
  const router = useRouter()
  const [status, setStatus]     = useState<FormStatus>('pending')
  const [siteId, setSiteId]     = useState('')
  const [personId, setPersonId] = useState('')
  const [formId, setFormId]     = useState('')
  const [from, setFrom]         = useState('')
  const [to, setTo]             = useState('')
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  // Filter options come from the rows themselves
  const options = useMemo(() => {
    const sites = new Map<string, string>()
    const people = new Map<string, string>()
    const forms = new Map<string, string>()
    for (const r of rows) {
      if (r.siteId) sites.set(r.siteId, r.siteName ?? 'Unknown site')
      people.set(r.assignedTo, r.assigneeName)
      forms.set(r.templateId, r.templateTitle)
    }
    const sorted = (m: Map<string, string>) => [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
    return { sites: sorted(sites), people: sorted(people), forms: sorted(forms) }
  }, [rows])

  // Everything except status, so the tab counts follow the other filters
  const filtered = useMemo(() => rows.filter(r => {
    if (siteId && r.siteId !== siteId) return false
    if (personId && r.assignedTo !== personId) return false
    if (formId && r.templateId !== formId) return false
    if ((from || to) && r.completedAt) {
      const day = perthYmd(r.completedAt)
      if (from && day < from) return false
      if (to && day > to) return false
    }
    return true
  }), [rows, siteId, personId, formId, from, to])

  const counts = useMemo(() => {
    const c: Record<FormStatus, number> = { pending: 0, completed: 0, overdue: 0 }
    for (const r of filtered) c[formStatus(r, todayPerth)]++
    return c
  }, [filtered, todayPerth])

  const visible = filtered
    .filter(r => formStatus(r, todayPerth) === status)
    .sort((a, b) => status === 'completed'
      ? String(b.completedAt).localeCompare(String(a.completedAt))
      : String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999')))

  const filtersActive = !!(siteId || personId || formId || from || to) || status !== 'pending'

  function resetFilters() {
    setStatus('pending'); setSiteId(''); setPersonId(''); setFormId(''); setFrom(''); setTo('')
  }

  async function handleDownload(a: AssignmentManagementRow) {
    setBusyId(a.id); setError(null)
    const result = await downloadSignedPdf(a.id)
    if (result.error) setError(result.error)
    setBusyId(null)
  }

  // Admin only: rebuild a missing signed PDF from the completion's snapshot
  async function handleRegenerate(a: AssignmentManagementRow) {
    if (!a.completionId) return
    setBusyId(a.id); setError(null)
    const result = await storeSignedPdf(a.id, a.completionId)
    if (result.error) setError(result.error)
    setBusyId(null)
    router.refresh()
  }

  async function handleRevoke(a: AssignmentManagementRow) {
    if (!window.confirm(`Revoke "${a.templateTitle}" for ${a.assigneeName}?`)) return
    setBusyId(a.id); setError(null)
    const result = await revokeAssignment(a.id)
    if (result?.error) setError(result.error)
    setBusyId(null)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1">
        {STATUS_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatus(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              status === t.id ? 'bg-green-700 text-white' : 'text-fg-muted hover:bg-surface-raised'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs ${status === t.id ? 'text-white/80' : t.id === 'overdue' && counts.overdue > 0 ? 'text-red-600' : 'text-fg-muted'}`}>
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <select value={siteId} onChange={e => setSiteId(e.target.value)} className={SELECT_CLASS} aria-label="Site">
          <option value="">All sites</option>
          {options.sites.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={personId} onChange={e => setPersonId(e.target.value)} className={SELECT_CLASS} aria-label="Staff member">
          <option value="">All staff</option>
          {options.people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={formId} onChange={e => setFormId(e.target.value)} className={SELECT_CLASS} aria-label="Form">
          <option value="">All forms</option>
          {options.forms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <label className="flex flex-col text-xs text-fg-muted">
          Completed from
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={SELECT_CLASS} />
        </label>
        <label className="flex flex-col text-xs text-fg-muted">
          to
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={SELECT_CLASS} />
        </label>
        <button
          type="button"
          onClick={resetFilters}
          disabled={!filtersActive}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-40 transition-colors"
        >
          Reset filters
        </button>
      </div>
      {(from || to) && status !== 'completed' && (
        <p className="text-xs text-fg-muted">The completed date range only applies to the Completed tab.</p>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {visible.length === 0 ? (
        <p className="text-sm text-fg-muted py-2">No {status} forms{filtersActive ? ' match these filters' : ''}.</p>
      ) : (
        <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
          {visible.map(a => {
            const s = formStatus(a, todayPerth)
            return (
              <div key={a.id} className="flex flex-wrap items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{a.assigneeName}</p>
                  <p className="text-xs text-fg-muted">
                    {a.templateTitle}
                    {a.siteName && ` · ${a.siteName}`}
                    {s === 'completed' && a.completedAt
                      ? ` · Completed ${new Date(a.completedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Perth' })}`
                      : a.dueDate ? ` · Due ${formatYmd(a.dueDate)}` : ' · No due date'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s]}`}>
                    {STATUS_TABS.find(t => t.id === s)?.label}
                  </span>
                  {s === 'completed' ? (
                    a.pdfStored ? (
                      <button
                        type="button"
                        onClick={() => handleDownload(a)}
                        disabled={busyId === a.id}
                        className="text-xs font-medium text-fg-muted hover:text-green-700 disabled:opacity-50 transition-colors"
                      >
                        {busyId === a.id ? 'Downloading…' : 'Download PDF'}
                      </button>
                    ) : (
                      <>
                        <span className="text-xs text-red-600" title={a.pdfError ?? undefined}>
                          {a.pdfError ? 'PDF failed' : 'PDF missing'}
                        </span>
                        {isAdmin && a.completionId && (
                          <button
                            type="button"
                            onClick={() => handleRegenerate(a)}
                            disabled={busyId === a.id}
                            className="text-xs font-medium text-fg-muted hover:text-green-700 disabled:opacity-50 transition-colors"
                          >
                            {busyId === a.id ? 'Regenerating…' : 'Regenerate PDF'}
                          </button>
                        )}
                      </>
                    )
                  ) : isAdmin && (
                    // Deleting assignments is admin-only (RLS sfa_delete)
                    <button
                      type="button"
                      onClick={() => handleRevoke(a)}
                      disabled={busyId === a.id}
                      className="text-xs text-fg-muted hover:text-red-600 disabled:opacity-50 transition-colors"
                    >
                      {busyId === a.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
