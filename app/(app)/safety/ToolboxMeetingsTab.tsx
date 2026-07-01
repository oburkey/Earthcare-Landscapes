'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { submitToolboxMeeting, deleteToolboxMeeting } from './actions'
import { LOGO_DATA_URL } from '@/lib/pdfAssets'
import type { Role } from '@/types/database'
import type { ToolboxMeetingRow, SiteOption, StaffOption } from './SafetyView'

// ── PDF ───────────────────────────────────────────────────────────────────────

const PDF_STYLES = `<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; color: #111; background: white; }
.html2pdf__container .page { padding: 20px 24px; }
.html2pdf__container .hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #111; }
.html2pdf__container .hdr-left h1 { font-size: 17px; font-weight: bold; margin-bottom: 3px; }
.html2pdf__container .hdr-left .sub { font-size: 9px; color: #555; margin-top: 2px; }
.html2pdf__container .hdr-right img { max-width: 120px; max-height: 48px; object-fit: contain; display: block; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container thead th { font-size: 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; padding: 4px 4px; border-bottom: 2px solid #bbb; text-align: left; white-space: nowrap; }
.html2pdf__container td { padding: 3.5px 4px; border-bottom: 1px solid #eee; font-size: 8.5px; vertical-align: top; }
.html2pdf__container .note { margin-top: 12px; font-size: 8px; color: #999; }
</style>`

async function downloadToolboxMeetingsPdf(
  meetings: ToolboxMeetingRow[],
  staff: StaffOption[],
  siteFilter: string,
  siteLabel: string,
  dateFrom: string,
  dateTo: string,
  onError: (msg: string) => void,
  onDone: () => void,
) {
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const filterParts = [
    dateFrom || dateTo ? [dateFrom, dateTo].filter(Boolean).join(' — ') : 'All dates',
    siteFilter ? `Site: ${siteLabel}` : 'All sites',
  ]
  const filterDesc = filterParts.join(' · ')

  const rows = meetings.map(m => `<tr>
    <td>${fmtDate(m.date)}</td>
    <td>${m.siteName}</td>
    <td>${m.topic}</td>
    <td>${m.attendees.map(id => { const s = staff.find(m => m.id === id); return s ? s.first_name + ' ' + s.last_name : id }).join(', ') || '—'}</td>
    <td>${m.submitterName}</td>
    <td>${m.notes ?? '—'}</td>
  </tr>`).join('')

  const html = `${PDF_STYLES}
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <h1>Toolbox Meeting Records</h1>
      <div class="sub">${filterDesc}</div>
      <div class="sub">Generated ${date} · ${meetings.length} record${meetings.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="hdr-right">
      ${LOGO_DATA_URL ? `<img src="${LOGO_DATA_URL}" alt="Earthcare" />` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Date</th><th>Site</th><th>Topic</th><th>Attendees</th><th>Submitted By</th><th>Notes</th></tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:8px;font-style:italic">No records</td></tr>'}
    </tbody>
  </table>
  <div class="note">Generated from Earthcare Landscapes — Toolbox Meeting Records</div>
</div>`

  const el = document.createElement('div')
  el.innerHTML = html
  try {
    const { default: html2pdf } = await import('html2pdf.js')
    const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (html2pdf() as any)
      .set({
        margin:      0,
        filename:    `Earthcare-ToolboxMeetings-${dateStr}.pdf`,
        image:       { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak:   { mode: ['css', 'legacy'] },
      })
      .from(el)
      .save()
  } catch {
    onError('Failed to generate PDF. Please try again.')
  } finally {
    onDone()
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function PdfIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  meetings:         ToolboxMeetingRow[]
  onMeetingsChange: Dispatch<SetStateAction<ToolboxMeetingRow[]>>
  sites:            SiteOption[]
  staff:            StaffOption[]
  role:             Role
  userId:           string
  userName:         string
  today:            string
  tableExists:      boolean
  canManage:        boolean
  isAdmin:          boolean
}

export default function ToolboxMeetingsTab({
  meetings,
  onMeetingsChange,
  sites,
  staff,
  userId,
  userName,
  today,
  tableExists,
  canManage,
  isAdmin,
}: Props) {
  const [view, setView] = useState<'list' | 'new'>('list')

  const staffName = (id: string) => {
    const s = staff.find(m => m.id === id)
    return s ? `${s.first_name} ${s.last_name}` : id
  }
  const attendeeNames = (ids: string[]) => ids.map(staffName).join(', ')

  // Filter state
  const [filterSite, setFilterSite] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo]     = useState('')
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError, setPdfError]           = useState<string | null>(null)

  // Form state
  const [siteId, setSiteId]     = useState('')
  const [date, setDate]         = useState(today)
  const [topic, setTopic]       = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting]               = useState(false)
  const [deleteError, setDeleteError]         = useState<string | null>(null)

  const filteredMeetings = meetings.filter(m => {
    if (filterSite && m.siteId !== filterSite) return false
    if (filterFrom && m.date < filterFrom) return false
    if (filterTo   && m.date > filterTo)   return false
    return true
  })

  function openNew() {
    setSiteId(''); setDate(today); setTopic(''); setAttendees([]); setNotes('')
    setFormError(null)
    setView('new')
  }

  function toggleAttendee(name: string) {
    setAttendees(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  async function handleSubmit() {
    if (!siteId) { setFormError('Please select a site'); return }
    if (!date)   { setFormError('Date is required'); return }
    if (!topic.trim()) { setFormError('Topic is required'); return }

    setSaving(true); setFormError(null)

    const fd = new FormData()
    fd.set('site_id',   siteId)
    fd.set('date',      date)
    fd.set('topic',     topic.trim())
    fd.set('notes',     notes)
    fd.set('attendees', JSON.stringify(attendees))

    const result = await submitToolboxMeeting(fd)
    setSaving(false)

    if (result?.error) { setFormError(result.error); return }

    const newRow: ToolboxMeetingRow = {
      id:            ('id' in result && result.id) ? result.id : crypto.randomUUID(),
      siteId,
      siteName:      sites.find(s => s.id === siteId)?.name ?? '',
      date,
      topic:         topic.trim(),
      notes:         notes || null,
      attendees,
      submittedBy:   userId,
      submitterName: userName,
      createdAt:     new Date().toISOString(),
    }
    onMeetingsChange(prev => [newRow, ...prev])
    setView('list')
  }

  function handleExportPdf() {
    const siteLabel = sites.find(s => s.id === filterSite)?.name ?? ''
    setPdfGenerating(true)
    setPdfError(null)
    downloadToolboxMeetingsPdf(
      filteredMeetings,
      staff,
      filterSite,
      siteLabel,
      filterFrom,
      filterTo,
      (msg) => setPdfError(msg),
      () => setPdfGenerating(false),
    )
  }

  async function handleDelete(id: string) {
    setDeleting(true); setDeleteError(null)
    const result = await deleteToolboxMeeting(id)
    setDeleting(false)
    if (result?.error) { setDeleteError(result.error); return }
    onMeetingsChange(prev => prev.filter(m => m.id !== id))
    setConfirmDeleteId(null)
  }

  // ── Form view ──────────────────────────────────────────────────────────────

  if (view === 'new') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setView('list')}
            className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg-secondary transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Toolbox Meetings
          </button>
          <span className="text-fg-muted">/</span>
          <h2 className="text-lg font-semibold text-fg">New toolbox meeting</h2>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 space-y-6">

          {/* Site + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Site *</label>
              <select value={siteId} onChange={e => setSiteId(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-border focus:outline-none">
                <option value="">— Select site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-border focus:outline-none" />
            </div>
          </div>

          {/* Topic */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Topic *</label>
            <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Working near overhead power lines"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none" />
          </div>

          {/* Attendees */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Attendees</label>
            {staff.length === 0 ? (
              <p className="text-sm text-fg-muted italic">No staff in directory</p>
            ) : (
              <div className="rounded-lg border border-border max-h-48 overflow-y-auto divide-y divide-border-subtle">
                {staff.map(s => (
                  <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-raised cursor-pointer">
                    <input type="checkbox" checked={attendees.includes(s.id)} onChange={() => toggleAttendee(s.id)}
                      className="h-4 w-4 rounded border-border text-accent-fg focus:ring-green-600" />
                    <span className="text-sm text-fg-secondary">{s.first_name} {s.last_name}</span>
                  </label>
                ))}
              </div>
            )}
            {attendees.length > 0 && (
              <p className="text-xs text-fg-muted">{attendees.length} selected: {attendeeNames(attendees)}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes…" rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-none" />
          </div>

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60 transition-colors">
            {saving ? 'Submitting…' : 'Submit toolbox meeting'}
          </button>
          <button type="button" onClick={() => setView('list')}
            className="text-sm text-fg-muted hover:text-fg-secondary transition-colors">Cancel</button>
        </div>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {!tableExists && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The <code className="font-mono">toolbox_meetings</code> table hasn&apos;t been created yet. Run the SQL migration to enable this feature.
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-fg-secondary">
            Toolbox Meetings — {meetings.length} record{meetings.length !== 1 ? 's' : ''}
          </h2>
          {canManage && (
            <button type="button" onClick={openNew}
              className="rounded-lg bg-green-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-800 transition-colors">
              + New toolbox meeting
            </button>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-3">Filter</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-fg-muted">From</label>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-border focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-fg-muted">To</label>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-border focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-fg-muted">Site</label>
              <select value={filterSite} onChange={e => setFilterSite(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-border focus:outline-none">
                <option value="">All sites</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterSite('') }}
                className="text-xs text-fg-muted hover:text-fg-secondary transition-colors">Clear</button>
              <button type="button" onClick={handleExportPdf}
                disabled={pdfGenerating || filteredMeetings.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50 transition-colors">
                {pdfGenerating ? <Spinner /> : <PdfIcon />}
                Export PDF
              </button>
            </div>
          </div>
          {pdfError && <p className="mt-2 text-xs text-red-600">{pdfError}</p>}
        </div>
      </div>

      {deleteError && !confirmDeleteId && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
      )}

      {filteredMeetings.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-14 text-center">
          <p className="text-sm font-medium text-fg-muted">No toolbox meetings for this filter</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
          {filteredMeetings.map(m => {
            const isConfirming = confirmDeleteId === m.id
            return (
              <div key={m.id} className="flex items-stretch">
                <div className="flex-1 flex items-start gap-3 px-5 py-4 min-w-0">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-fg text-sm">{m.siteName}</span>
                      <span className="text-xs text-fg-muted">{fmtDate(m.date)}</span>
                    </div>
                    <p className="text-sm text-fg-secondary">{m.topic}</p>
                    <div className="flex items-center gap-3 text-xs text-fg-muted flex-wrap">
                      <span>Submitted by {m.submitterName}</span>
                      {m.attendees.length > 0 && (
                        <span>· {m.attendees.length} attendee{m.attendees.length !== 1 ? 's' : ''}: {attendeeNames(m.attendees)}</span>
                      )}
                    </div>
                    {m.notes && (
                      <p className="text-xs text-fg-muted whitespace-pre-wrap">{m.notes}</p>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center px-4 border-l border-border-subtle shrink-0">
                    {isConfirming ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-fg-muted">Delete?</span>
                        <button type="button" onClick={() => handleDelete(m.id)} disabled={deleting}
                          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors">
                          {deleting ? '…' : 'Yes'}
                        </button>
                        <button type="button" onClick={() => { setConfirmDeleteId(null); setDeleteError(null) }}
                          className="text-xs text-fg-muted hover:text-fg-muted transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(m.id)}
                        className="text-xs text-fg-muted hover:text-red-500 transition-colors">Delete</button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
