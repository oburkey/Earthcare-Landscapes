'use client'

import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { submitIncident, updateIncidentAdminNotes, deleteIncident, getIncidentPhotoUrl } from './actions'
import { compressImage } from '@/lib/compressImage'
import { LOGO_DATA_URL } from '@/lib/pdfAssets'
import type { Role } from '@/types/database'
import type { IncidentRow, SiteOption } from './SafetyView'

// ── Constants ─────────────────────────────────────────────────────────────────

export const TYPE_CONFIG = {
  incident:        { label: 'Incident',        cls: 'bg-red-100 text-red-700' },
  near_miss:       { label: 'Near Miss',       cls: 'bg-amber-100 text-amber-700' },
  first_aid:       { label: 'First Aid',       cls: 'bg-blue-100 text-blue-700' },
  property_damage: { label: 'Property Damage', cls: 'bg-orange-100 text-orange-700' },
} as const

type IncidentType = keyof typeof TYPE_CONFIG

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtTime(t: string | null) {
  if (!t) return null
  const [h, m] = t.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m))
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

function nowTimeStr() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// ── PDF ───────────────────────────────────────────────────────────────────────

const PDF_STYLES = `<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #111; background: white; }
.html2pdf__container .page { padding: 18px 22px; }
.html2pdf__container .hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #111; }
.html2pdf__container .hdr-left h1 { font-size: 16px; font-weight: bold; margin-bottom: 3px; }
.html2pdf__container .hdr-left .sub { font-size: 8.5px; color: #555; margin-top: 2px; }
.html2pdf__container .hdr-right img { max-width: 110px; max-height: 44px; object-fit: contain; display: block; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container thead th { font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; padding: 4px; border-bottom: 2px solid #bbb; text-align: left; white-space: nowrap; }
.html2pdf__container td { padding: 3px 4px; border-bottom: 1px solid #eee; font-size: 8px; vertical-align: top; }
.html2pdf__container .badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 7px; font-weight: bold; }
.html2pdf__container .badge-incident { background:#fee2e2; color:#991b1b; }
.html2pdf__container .badge-near_miss { background:#fef3c7; color:#92400e; }
.html2pdf__container .badge-first_aid { background:#dbeafe; color:#1e40af; }
.html2pdf__container .badge-property_damage { background:#ffedd5; color:#9a3412; }
.html2pdf__container .note { margin-top: 12px; font-size: 8px; color: #999; }
</style>`

async function downloadIncidentsPdf(
  incidents: IncidentRow[],
  siteLabel: string,
  filterFrom: string,
  filterTo: string,
  filterType: string,
  onError: (msg: string) => void,
  onDone: () => void,
) {
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const filterParts = [
    filterFrom || filterTo ? [filterFrom, filterTo].filter(Boolean).join(' — ') : 'All dates',
    siteLabel ? `Site: ${siteLabel}` : 'All sites',
    filterType ? `Type: ${TYPE_CONFIG[filterType as IncidentType]?.label ?? filterType}` : 'All types',
  ]

  const rows = incidents.map(i => {
    const cfg = TYPE_CONFIG[i.type as IncidentType] ?? { label: i.type }
    const timeStr = fmtTime(i.time)
    return `<tr>
      <td>${fmtDate(i.date)}${timeStr ? `<br><span style="color:#888">${timeStr}</span>` : ''}</td>
      <td>${i.siteName}</td>
      <td><span class="badge badge-${i.type}">${cfg.label}</span></td>
      <td style="max-width:160px">${i.description}</td>
      <td>${i.peopleInvolved ?? '—'}</td>
      <td>${i.immediateAction ?? '—'}</td>
      <td>${i.reporterName}</td>
      <td>${i.adminNotes ?? '—'}</td>
    </tr>`
  }).join('')

  const html = `${PDF_STYLES}
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <h1>Incident Register</h1>
      <div class="sub">${filterParts.join(' · ')}</div>
      <div class="sub">Generated ${date} · ${incidents.length} record${incidents.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="hdr-right">
      ${LOGO_DATA_URL ? `<img src="${LOGO_DATA_URL}" alt="Earthcare" />` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Site</th><th>Type</th><th>Description</th>
        <th>People Involved</th><th>Immediate Action</th><th>Reported By</th><th>Follow-up Notes</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="8" style="text-align:center;color:#aaa;padding:8px;font-style:italic">No records</td></tr>'}
    </tbody>
  </table>
  <div class="note">Generated from Earthcare Landscapes — Incident Register</div>
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
        filename:    `Earthcare-Incidents-${dateStr}.pdf`,
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

// ── Icons ─────────────────────────────────────────────────────────────────────

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

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-fg-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg className="h-5 w-5 text-fg-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  )
}

// ── Detail field ──────────────────────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">{label}</p>
      <p className="text-sm text-fg-secondary whitespace-pre-wrap">{value ?? <span className="italic text-fg-muted">—</span>}</p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  incidents:         IncidentRow[]
  onIncidentsChange: Dispatch<SetStateAction<IncidentRow[]>>
  sites:             SiteOption[]
  role:              Role
  userId:            string
  userName:          string
  today:             string
  tableExists:       boolean
  canManage:         boolean
  isAdmin:           boolean
}

export default function IncidentsTab({
  incidents,
  onIncidentsChange,
  sites,
  userId,
  userName,
  today,
  tableExists,
  canManage,
  isAdmin,
}: Props) {
  const [view, setView] = useState<'list' | 'new'>('list')

  // Filters
  const [filterSite, setFilterSite] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo,   setFilterTo]   = useState('')
  const [filterType, setFilterType] = useState('')

  // PDF
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError,      setPdfError]      = useState<string | null>(null)

  // Expand + lazy photos
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [photoUrls,     setPhotoUrls]     = useState<Record<string, string[]>>({})
  const [loadingPhotos, setLoadingPhotos] = useState(false)

  // Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting,        setDeleting]        = useState(false)
  const [deleteError,     setDeleteError]     = useState<string | null>(null)

  // Admin notes
  const [editingNotesId,    setEditingNotesId]    = useState<string | null>(null)
  const [editingNotesValue, setEditingNotesValue] = useState('')
  const [savingNotes,       setSavingNotes]       = useState(false)
  const [notesError,        setNotesError]        = useState<string | null>(null)

  // Form
  const [siteId,          setSiteId]          = useState('')
  const [date,            setDate]            = useState(today)
  const [time,            setTime]            = useState('')
  const [type,            setType]            = useState<IncidentType | ''>('')
  const [description,     setDescription]     = useState('')
  const [peopleInvolved,  setPeopleInvolved]  = useState('')
  const [immediateAction, setImmediateAction] = useState('')
  const [photos,          setPhotos]          = useState<File[]>([])
  const [photoPreviews,   setPhotoPreviews]   = useState<string[]>([])
  const [saving,          setSaving]          = useState(false)
  const [formError,       setFormError]       = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = incidents.filter(i => {
    if (filterSite && i.siteId !== filterSite) return false
    if (filterFrom && i.date < filterFrom)      return false
    if (filterTo   && i.date > filterTo)        return false
    if (filterType && i.type !== filterType)    return false
    return true
  })

  async function handleExpand(incident: IncidentRow) {
    if (expandedId === incident.id) {
      setExpandedId(null)
      setEditingNotesId(null)
      setConfirmDeleteId(null)
      return
    }
    setExpandedId(incident.id)
    setEditingNotesId(null)
    setConfirmDeleteId(null)
    if (incident.photoPaths.length > 0 && !photoUrls[incident.id]) {
      setLoadingPhotos(true)
      try {
        const urls = await Promise.all(incident.photoPaths.map(p => getIncidentPhotoUrl(p)))
        setPhotoUrls(prev => ({ ...prev, [incident.id]: urls }))
      } finally {
        setLoadingPhotos(false)
      }
    }
  }

  async function handleAddPhoto(file: File) {
    const compressed = await compressImage(file, 1400, 1_000_000)
    setPhotos(prev => [...prev, compressed])
    setPhotoPreviews(prev => [...prev, URL.createObjectURL(compressed)])
  }

  function removePhoto(idx: number) {
    URL.revokeObjectURL(photoPreviews[idx])
    setPhotos(prev => prev.filter((_, i) => i !== idx))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  function openNew() {
    setSiteId(''); setDate(today); setTime(nowTimeStr())
    setType(''); setDescription(''); setPeopleInvolved(''); setImmediateAction('')
    setPhotos([]); setPhotoPreviews([]); setFormError(null)
    setView('new')
  }

  async function handleSubmit() {
    if (!siteId)             { setFormError('Please select a site'); return }
    if (!date)               { setFormError('Date is required'); return }
    if (!type)               { setFormError('Please select a type'); return }
    if (!description.trim()) { setFormError('Description is required'); return }

    setSaving(true); setFormError(null)

    const fd = new FormData()
    fd.set('site_id',          siteId)
    fd.set('date',             date)
    fd.set('time',             time)
    fd.set('type',             type)
    fd.set('description',      description.trim())
    fd.set('people_involved',  peopleInvolved.trim())
    fd.set('immediate_action', immediateAction.trim())
    photos.forEach((p, i) => fd.set(`photo_${i}`, p))

    const result = await submitIncident(fd)
    setSaving(false)

    if (result?.error) { setFormError(result.error); return }

    const newRow: IncidentRow = {
      id:              'id' in result && result.id ? result.id : crypto.randomUUID(),
      siteId,
      siteName:        sites.find(s => s.id === siteId)?.name ?? '',
      date,
      time:            time || null,
      type:            type as IncidentType,
      description:     description.trim(),
      peopleInvolved:  peopleInvolved.trim() || null,
      immediateAction: immediateAction.trim() || null,
      reportedBy:      userId,
      reporterName:    userName,
      adminNotes:      null,
      photoPaths:      'photoPaths' in result ? (result as { photoPaths: string[] }).photoPaths : [],
      createdAt:       new Date().toISOString(),
    }
    onIncidentsChange(prev => [newRow, ...prev])
    setView('list')
  }

  async function handleSaveNotes(id: string) {
    setSavingNotes(true); setNotesError(null)
    const result = await updateIncidentAdminNotes(id, editingNotesValue)
    setSavingNotes(false)
    if (result?.error) { setNotesError(result.error); return }
    onIncidentsChange(prev =>
      prev.map(i => i.id === id ? { ...i, adminNotes: editingNotesValue || null } : i)
    )
    setEditingNotesId(null)
  }

  async function handleDelete(id: string) {
    setDeleting(true); setDeleteError(null)
    const result = await deleteIncident(id)
    setDeleting(false)
    if (result?.error) { setDeleteError(result.error); return }
    onIncidentsChange(prev => prev.filter(i => i.id !== id))
    if (expandedId === id) setExpandedId(null)
    setConfirmDeleteId(null)
  }

  function handleExportPdf() {
    const siteLabel = sites.find(s => s.id === filterSite)?.name ?? ''
    setPdfGenerating(true); setPdfError(null)
    downloadIncidentsPdf(filtered, siteLabel, filterFrom, filterTo, filterType,
      msg => setPdfError(msg),
      () => setPdfGenerating(false),
    )
  }

  // ── Form view ──────────────────────────────────────────────────────────────

  if (view === 'new') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setView('list')}
            className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Incidents
          </button>
          <span className="text-fg-muted">/</span>
          <h2 className="text-lg font-semibold text-fg">New incident report</h2>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 space-y-6">

          {/* Site / Date / Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-border focus:outline-none" />
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.entries(TYPE_CONFIG) as [IncidentType, { label: string; cls: string }][]).map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => setType(key)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium text-left transition-colors ${
                    type === key
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-border text-fg-secondary hover:border-border'
                  }`}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe what happened…" rows={4}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-none" />
          </div>

          {/* People involved */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">People involved</label>
            <textarea value={peopleInvolved} onChange={e => setPeopleInvolved(e.target.value)}
              placeholder="Names of people involved or injured…" rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-none" />
          </div>

          {/* Immediate action */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Immediate action taken</label>
            <textarea value={immediateAction} onChange={e => setImmediateAction(e.target.value)}
              placeholder="What was done immediately after the incident…" rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-none" />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Photos (optional)</label>
            {photoPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photoPreviews.map((url, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover border border-border" />
                    <button type="button" onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold hover:bg-red-700">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={async e => {
                const f = e.target.files?.[0]
                if (f) await handleAddPhoto(f)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }} />
            {photos.length < 10 && (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-fg-muted hover:border-border hover:text-fg-secondary transition-colors">
                <CameraIcon />
                Add photo
              </button>
            )}
          </div>

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60 transition-colors">
            {saving ? 'Submitting…' : 'Submit incident report'}
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
          The <code className="font-mono">incidents</code> table hasn&apos;t been created yet. Run the SQL migration to enable this feature.
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-fg-secondary">
            Incidents — {incidents.length} record{incidents.length !== 1 ? 's' : ''}
          </h2>
          {canManage && tableExists && (
            <button type="button" onClick={openNew}
              className="rounded-lg bg-green-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-800 transition-colors">
              + New incident
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-3">Filter</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
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
            <div className="space-y-1">
              <label className="text-xs text-fg-muted">Type</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-border focus:outline-none">
                <option value="">All types</option>
                {(Object.entries(TYPE_CONFIG) as [IncidentType, { label: string }][]).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterSite(''); setFilterType('') }}
                className="text-xs text-fg-muted hover:text-fg-secondary transition-colors">Clear</button>
              <button type="button" onClick={handleExportPdf}
                disabled={pdfGenerating || filtered.length === 0}
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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-14 text-center">
          <p className="text-sm font-medium text-fg-muted">
            {incidents.length === 0 ? 'No incidents recorded yet.' : 'No incidents match this filter.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
          {filtered.map(incident => {
            const cfg = TYPE_CONFIG[incident.type as IncidentType] ?? { label: incident.type, cls: 'bg-surface-raised text-fg-secondary' }
            const isExpanded     = expandedId === incident.id
            const isConfirming   = confirmDeleteId === incident.id
            const isEditingNotes = editingNotesId === incident.id
            const timeLabel      = fmtTime(incident.time)

            return (
              <div key={incident.id}>

                {/* Summary row — click to expand */}
                <button
                  type="button"
                  onClick={() => handleExpand(incident)}
                  className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-surface-raised transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-fg-muted">
                        {fmtDate(incident.date)}{timeLabel ? ` · ${timeLabel}` : ''}
                      </span>
                      <span className="font-semibold text-fg text-sm">{incident.siteName}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                      {incident.photoPaths.length > 0 && (
                        <span className="text-xs text-fg-muted">
                          · {incident.photoPaths.length} photo{incident.photoPaths.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-fg-secondary line-clamp-2">{incident.description}</p>
                    <p className="text-xs text-fg-muted">Reported by {incident.reporterName}</p>
                  </div>
                  <ChevronIcon expanded={isExpanded} />
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border-subtle bg-surface-raised px-5 py-4 space-y-4">

                    <div className="space-y-3">
                      <DetailField label="Description" value={incident.description} />
                      <DetailField label="People involved" value={incident.peopleInvolved} />
                      <DetailField label="Immediate action taken" value={incident.immediateAction} />
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Reported by</p>
                        <p className="text-sm text-fg-secondary">{incident.reporterName}</p>
                      </div>
                    </div>

                    {/* Photos */}
                    {incident.photoPaths.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Photos</p>
                        {loadingPhotos && !photoUrls[incident.id] ? (
                          <p className="text-xs text-fg-muted">Loading photos…</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(photoUrls[incident.id] ?? []).map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`Photo ${i + 1}`}
                                  className="h-24 w-24 rounded-lg object-cover border border-border hover:opacity-90 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Follow-up notes (admin notes) */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Follow-up notes</p>
                        {isAdmin && !isEditingNotes && (
                          <button type="button"
                            onClick={() => {
                              setEditingNotesId(incident.id)
                              setEditingNotesValue(incident.adminNotes ?? '')
                              setNotesError(null)
                            }}
                            className="text-xs text-fg-muted underline underline-offset-2 hover:text-fg-secondary transition-colors">
                            {incident.adminNotes ? 'Edit' : 'Add'}
                          </button>
                        )}
                      </div>
                      {isEditingNotes ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingNotesValue}
                            onChange={e => setEditingNotesValue(e.target.value)}
                            rows={3}
                            placeholder="Admin follow-up notes…"
                            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-none bg-surface"
                          />
                          {notesError && <p className="text-xs text-red-600">{notesError}</p>}
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => handleSaveNotes(incident.id)} disabled={savingNotes}
                              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-60 transition-colors">
                              {savingNotes ? 'Saving…' : 'Save'}
                            </button>
                            <button type="button" onClick={() => { setEditingNotesId(null); setNotesError(null) }}
                              className="text-xs text-fg-muted hover:text-fg-secondary transition-colors">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-fg-secondary whitespace-pre-wrap">
                          {incident.adminNotes ?? <span className="italic text-fg-muted">None</span>}
                        </p>
                      )}
                    </div>

                    {/* Admin delete */}
                    {isAdmin && (
                      <div className="pt-1 border-t border-border">
                        {isConfirming ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-fg-muted">Delete this incident and all photos?</span>
                            <button type="button" onClick={() => handleDelete(incident.id)} disabled={deleting}
                              className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors">
                              {deleting ? '…' : 'Yes, delete'}
                            </button>
                            <button type="button"
                              onClick={() => { setConfirmDeleteId(null); setDeleteError(null) }}
                              className="text-xs text-fg-muted hover:text-fg-secondary transition-colors">Cancel</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setConfirmDeleteId(incident.id)}
                            className="text-xs text-fg-muted hover:text-red-500 transition-colors">
                            Delete incident
                          </button>
                        )}
                      </div>
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
