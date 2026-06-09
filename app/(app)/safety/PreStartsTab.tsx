'use client'

import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { submitPreStart, getSafetyDocUrl, deletePreStart } from './actions'
import { compressImage } from '@/lib/compressImage'
import { LOGO_DATA_URL } from '@/lib/pdfAssets'
import type { Role } from '@/types/database'
import type { PreStartRow, SiteOption, StaffOption, VehicleOption } from './SafetyView'

// ── Constants ─────────────────────────────────────────────────────────────────

const WEATHER_OPTIONS = ['Fine', 'Hot', 'Wet', 'Windy', 'Extreme heat'] as const

const CHECKLIST_ITEMS = [
  { key: 'no_new_damage',   label: 'Is the machine free of new damage since last use?' },
  { key: 'fluid_levels',    label: 'Are all fluid levels checked (fuel, oil, hydraulic)?' },
  { key: 'brakes_steering', label: 'Are brakes and steering operating correctly?' },
  { key: 'guards_safety',   label: 'Are all guards and safety devices in place?' },
  { key: 'seatbelt',        label: 'Is the seatbelt working and in good condition?' },
  { key: 'tyres_tracks',    label: 'Are tyres/tracks in good condition?' },
  { key: 'greased_today',   label: 'Has the machine been greased today?' },
  { key: 'faults_concerns', label: 'Are there any faults or concerns to report?' },
] as const

type CheckKey = typeof CHECKLIST_ITEMS[number]['key']
type CheckVal = 'yes' | 'no' | 'na' | ''

function defaultChecks(): Record<CheckKey, CheckVal> {
  return {
    no_new_damage:   '',
    fluid_levels:    '',
    brakes_steering: '',
    guards_safety:   '',
    seatbelt:        '',
    tyres_tracks:    '',
    greased_today:   '',
    faults_concerns: '',
  }
}

function pdfCheckVal(val: string | undefined, inverted = false): string {
  if (val === 'yes') return inverted ? '<span style="color:#dc2626;font-weight:bold">Yes</span>' : '<span style="color:#16a34a;font-weight:bold">Yes</span>'
  if (val === 'no')  return inverted ? '<span style="color:#16a34a;font-weight:bold">No</span>'  : '<span style="color:#dc2626;font-weight:bold">No</span>'
  if (val === 'na')  return '<span style="color:#999">N/A</span>'
  return '<span style="color:#ccc">—</span>'
}

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
.html2pdf__container .ok  { color: #16a34a; font-weight: bold; }
.html2pdf__container .bad { color: #dc2626; font-weight: bold; }
.html2pdf__container .warn { color: #d97706; }
.html2pdf__container .note { margin-top: 12px; font-size: 8px; color: #999; }
</style>`

async function downloadPreStartsPdf(
  preStarts: PreStartRow[],
  vehicles: VehicleOption[],
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

  const rows = preStarts.map(ps => {
    const hazard = ps.siteHazards ? `<span class="warn">Yes</span>` : 'No'
    const summaryRow = `<tr>
      <td>${ps.date}</td>
      <td>${ps.siteName}</td>
      <td>${ps.submitterName}</td>
      <td>${ps.crewPresent.join(', ') || '—'}</td>
      <td>${ps.weather.join(', ') || '—'}</td>
      <td>${hazard}</td>
      <td class="${ps.ppeConfirmed ? 'ok' : 'bad'}">${ps.ppeConfirmed ? '✓' : '✗'}</td>
      <td class="${ps.fitForWork ? 'ok' : 'bad'}">${ps.fitForWork ? '✓' : '✗'}</td>
      <td>${ps.usingMachinery ? 'Yes' : 'No'}</td>
    </tr>`

    if (!ps.usingMachinery || !ps.machineryChecks) return summaryRow

    const mc = ps.machineryChecks
    const machine = ps.machineId ? vehicles.find(v => v.id === ps.machineId) : null

    const machineName = machine ? `${machine.make} ${machine.model}` : '—'
    const machineRego = machine?.registration ?? null
    const machineLocation = machine?.assigned_to ?? null

    const checklistRows = CHECKLIST_ITEMS.map(item => {
      const val = mc[item.key] ?? ''
      const inverted = item.key === 'faults_concerns'
      return `<tr>
        <td style="padding:1.5px 6px 1.5px 0;font-size:7.5px;color:#444;border-bottom:1px solid #f0f0f0;">${item.label}</td>
        <td style="padding:1.5px 0;font-size:7.5px;white-space:nowrap;border-bottom:1px solid #f0f0f0;text-align:right;">${pdfCheckVal(val, inverted)}</td>
      </tr>`
    }).join('')

    const faultNotes = [
      mc.damage_description ? `<div style="margin-top:4px;font-size:7.5px;"><span style="font-weight:bold;color:#dc2626;">Damage noted: </span><span style="color:#7f1d1d;">${mc.damage_description}</span></div>` : '',
      mc.greased_why_not    ? `<div style="margin-top:3px;font-size:7.5px;"><span style="font-weight:bold;color:#d97706;">Not greased: </span><span style="color:#78350f;">${mc.greased_why_not}</span></div>` : '',
    ].filter(Boolean).join('')

    const photosLine = ps.photoPaths.length > 0
      ? `<div style="margin-top:4px;font-size:7.5px;color:#6b7280;">${ps.photoPaths.length} photo${ps.photoPaths.length !== 1 ? 's' : ''} attached</div>`
      : ''

    const detailRow = `<tr>
      <td colspan="9" style="padding:5px 8px 7px 8px;background:#fffbeb;border-bottom:2px solid #fde68a;">
        <div style="display:flex;gap:16px;align-items:flex-start;">
          <div style="min-width:160px;max-width:200px;flex-shrink:0;">
            <div style="font-size:7px;font-weight:bold;text-transform:uppercase;color:#92400e;margin-bottom:3px;letter-spacing:0.05em;">Machine</div>
            <div style="font-size:8.5px;font-weight:bold;color:#111;">${machineName}</div>
            ${machineRego     ? `<div style="font-size:7.5px;color:#555;margin-top:1px;">${machineRego}</div>` : ''}
            ${machineLocation ? `<div style="font-size:7.5px;color:#555;">Location: ${machineLocation}</div>` : ''}
            ${mc.hours_today  ? `<div style="font-size:7.5px;color:#555;margin-top:3px;">Meter reading: <strong>${mc.hours_today} hrs</strong></div>` : ''}
            ${photosLine}
            ${faultNotes}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:7px;font-weight:bold;text-transform:uppercase;color:#92400e;margin-bottom:3px;letter-spacing:0.05em;">Pre-Start Checklist</div>
            <table style="width:100%;border-collapse:collapse;">
              <tbody>${checklistRows}</tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>`

    return summaryRow + detailRow
  }).join('')

  const html = `${PDF_STYLES}
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <h1>Pre-Start Records</h1>
      <div class="sub">${filterDesc}</div>
      <div class="sub">Generated ${date} · ${preStarts.length} record${preStarts.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="hdr-right">
      ${LOGO_DATA_URL ? `<img src="${LOGO_DATA_URL}" alt="Earthcare" />` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Date</th><th>Site</th><th>Submitted By</th><th>Crew</th><th>Weather</th><th>Hazards</th><th>PPE</th><th>Fit</th><th>Machinery</th></tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="9" style="text-align:center;color:#aaa;padding:8px;font-style:italic">No records</td></tr>'}
    </tbody>
  </table>
  <div class="note">Generated from Earthcare Landscapes — Safety Pre-Start Records</div>
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
        filename:    `Earthcare-PreStarts-${dateStr}.pdf`,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function checkLabel(val: string, inverted = false) {
  if (val === 'yes') return <span className={`${inverted ? 'text-red-600' : 'text-green-700'} font-medium`}>Yes</span>
  if (val === 'no')  return <span className={`${inverted ? 'text-green-700' : 'text-red-600'} font-medium`}>No</span>
  if (val === '')    return <span className="text-stone-300">—</span>
  return <span className="text-stone-400">N/A</span>
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  preStarts:          PreStartRow[]
  onPreStartsChange:  Dispatch<SetStateAction<PreStartRow[]>>
  sites:              SiteOption[]
  staff:              StaffOption[]
  vehicles:           VehicleOption[]
  role:               Role
  userId:             string
  userName:           string
  today:              string
  tableExists:        boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PreStartsTab({
  preStarts,
  onPreStartsChange,
  sites,
  staff,
  vehicles,
  role,
  userId,
  userName,
  today,
  tableExists,
}: Props) {
  const isSupervisorPlus = role === 'supervisor' || role === 'admin'
  const isAdmin          = role === 'admin'

  // Only machinery-type vehicles in the selector
  const machineryVehicles = vehicles.filter(v => v.vehicle_type === 'Machinery')

  // ── List state ─────────────────────────────────────────────────────────────
  // localPreStarts state is owned by SafetyView (passed via preStarts + onPreStartsChange)
  // so it persists when this component unmounts during tab switches.
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailPhotoUrls, setDetailPhotoUrls] = useState<string[]>([])

  // Filter state (supervisor)
  const [filterSite, setFilterSite] = useState('')
  const [filterFrom, setFilterFrom] = useState(today)
  const [filterTo, setFilterTo]     = useState(today)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError, setPdfError]           = useState<string | null>(null)

  // ── Form state ─────────────────────────────────────────────────────────────
  const [siteId, setSiteId]             = useState('')
  const [date, setDate]                 = useState(today)
  const [crewPresent, setCrewPresent]   = useState<string[]>([])
  const [weather, setWeather]           = useState<string[]>([])
  const [siteHazards, setSiteHazards]   = useState('')
  const [ppeConfirmed, setPpeConfirmed] = useState(true)
  const [fitForWork, setFitForWork]     = useState(true)
  const [usingMachinery, setUsingMachinery] = useState(false)
  const [machineId, setMachineId]       = useState('')
  const [machineHours, setMachineHours] = useState('')
  const [checks, setChecks]             = useState<Record<CheckKey, CheckVal>>(defaultChecks())
  const [greasedWhyNot, setGreasedWhyNot]       = useState('')
  const [damageDescription, setDamageDescription] = useState('')
  const [notes, setNotes]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [formError, setFormError]       = useState<string | null>(null)

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId]       = useState<string | null>(null)
  const [confirmDeleteDetail, setConfirmDeleteDetail] = useState(false)
  const [deleting, setDeleting]                     = useState(false)
  const [deleteError, setDeleteError]               = useState<string | null>(null)

  // Photo state
  const [pendingPhotos, setPendingPhotos]   = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews]   = useState<string[]>([])
  const [compressingPhotos, setCompressingPhotos] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // ── Computed ───────────────────────────────────────────────────────────────

  const filteredPreStarts = isSupervisorPlus
    ? preStarts.filter((ps) => {
        if (filterSite && ps.siteId !== filterSite) return false
        if (filterFrom && ps.date < filterFrom) return false
        if (filterTo   && ps.date > filterTo)   return false
        return true
      })
    : preStarts

  const todaysPreStarts    = preStarts.filter(ps => ps.date === today)
  const selectedPreStart   = detailId ? preStarts.find(ps => ps.id === detailId) : null
  const selectedVehicle    = machineryVehicles.find(v => v.id === machineId)

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openNew() {
    // Clean up any existing object URLs
    photoPreviews.forEach(url => URL.revokeObjectURL(url))
    setSiteId(''); setDate(today); setCrewPresent([]); setWeather([])
    setSiteHazards(''); setPpeConfirmed(true); setFitForWork(true)
    setUsingMachinery(false); setMachineId(''); setMachineHours('')
    setChecks(defaultChecks()); setGreasedWhyNot(''); setDamageDescription('')
    setNotes(''); setFormError(null)
    setPendingPhotos([]); setPhotoPreviews([])
    setView('new')
  }

  async function openDetail(id: string) {
    setDetailId(id)
    setDetailPhotoUrls([])
    setView('detail')

    const ps = preStarts.find(p => p.id === id)
    if (ps && ps.photoPaths.length > 0) {
      const urls = await Promise.all(ps.photoPaths.map(path => getSafetyDocUrl(path)))
      setDetailPhotoUrls(urls.filter(Boolean))
    }
  }

  function toggleCrew(name: string) {
    setCrewPresent(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  function toggleWeather(w: string) {
    setWeather(prev =>
      prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]
    )
  }

  function setCheck(key: CheckKey, val: CheckVal) {
    setChecks(prev => ({ ...prev, [key]: val }))
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setCompressingPhotos(true)
    const newFiles: File[] = []
    const newPreviews: string[] = []

    for (const file of files) {
      try {
        const compressed = await compressImage(file, 1920, 800 * 1024)
        newFiles.push(compressed)
        newPreviews.push(URL.createObjectURL(compressed))
      } catch { /* skip */ }
    }

    setCompressingPhotos(false)
    setPendingPhotos(prev => [...prev, ...newFiles])
    setPhotoPreviews(prev => [...prev, ...newPreviews])
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index])
    setPendingPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!siteId) { setFormError('Please select a site'); return }
    if (!date)   { setFormError('Date is required'); return }

    if (usingMachinery) {
      if (checks.greased_today === 'no' && !greasedWhyNot.trim()) {
        setFormError('Please explain why the machine was not greased today')
        return
      }
      if (checks.no_new_damage === 'no' && !damageDescription.trim()) {
        setFormError('Please describe the new damage found on the machine')
        return
      }
    }

    setSaving(true); setFormError(null)

    const fd = new FormData()
    fd.set('site_id', siteId)
    fd.set('date', date)
    fd.set('crew_present', JSON.stringify(crewPresent))
    fd.set('weather', JSON.stringify(weather))
    fd.set('site_hazards', siteHazards)
    fd.set('ppe_confirmed', String(ppeConfirmed))
    fd.set('fit_for_work', String(fitForWork))
    fd.set('using_machinery', String(usingMachinery))
    fd.set('machine_id', machineId)
    fd.set('hours_today', machineHours)
    if (usingMachinery) {
      fd.set('machinery_checks', JSON.stringify({
        ...checks,
        hours_today:         machineHours,
        greased_why_not:     greasedWhyNot,
        damage_description:  damageDescription,
      }))
    }
    fd.set('notes', notes)

    // Attach compressed photos
    pendingPhotos.forEach((photo, i) => {
      fd.append(`photo_${i}`, photo, photo.name)
    })

    const result = await submitPreStart(fd)
    setSaving(false)

    if (result?.error) { setFormError(result.error); return }

    // Clean up object URLs now that submission succeeded
    photoPreviews.forEach(url => URL.revokeObjectURL(url))

    const newRow: PreStartRow = {
      id:             ('id' in result && result.id) ? result.id : crypto.randomUUID(),
      siteId,
      siteName:       sites.find(s => s.id === siteId)?.name ?? '',
      submittedBy:    userId,
      submitterName:  userName,
      date,
      crewPresent,
      weather,
      siteHazards:    siteHazards || null,
      ppeConfirmed,
      fitForWork,
      usingMachinery,
      machineryChecks: usingMachinery ? {
        ...checks,
        hours_today:        machineHours,
        greased_why_not:    greasedWhyNot,
        damage_description: damageDescription,
      } : null,
      machineId:      usingMachinery ? machineId : null,
      notes:          notes || null,
      photoPaths:     ('photoPaths' in result && Array.isArray(result.photoPaths)) ? result.photoPaths : [],
      createdAt:      new Date().toISOString(),
    }
    onPreStartsChange(prev => [newRow, ...prev])
    setView('list')
  }

  function handleExportPdf() {
    const siteLabel = sites.find(s => s.id === filterSite)?.name ?? ''
    setPdfGenerating(true)
    setPdfError(null)
    downloadPreStartsPdf(
      filteredPreStarts,
      vehicles,
      filterSite,
      siteLabel,
      filterFrom,
      filterTo,
      (msg) => setPdfError(msg),
      () => setPdfGenerating(false),
    )
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    setDeleteError(null)
    const result = await deletePreStart(id)
    setDeleting(false)
    if (result?.error) { setDeleteError(result.error); return }
    onPreStartsChange(prev => prev.filter(ps => ps.id !== id))
    setConfirmDeleteId(null)
    setConfirmDeleteDetail(false)
    setDetailId(null)
    setView('list')
  }

  // ── Detail view ────────────────────────────────────────────────────────────

  if (view === 'detail' && selectedPreStart) {
    const ps = selectedPreStart
    const mc = ps.machineryChecks
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setView('list')}
            className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Pre-starts
          </button>
          <span className="text-stone-300">/</span>
          <h2 className="text-lg font-semibold text-stone-900">{fmtDate(ps.date)}</h2>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Site"         value={ps.siteName} />
            <Field label="Date"         value={fmtDate(ps.date)} />
            <Field label="Submitted By" value={ps.submitterName} />
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Crew Present</p>
              <p className="text-sm text-stone-900">
                {ps.crewPresent.length > 0
                  ? ps.crewPresent.join(', ')
                  : <span className="text-stone-400 italic">None listed</span>
                }
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Weather</p>
              <div className="flex flex-wrap gap-1">
                {ps.weather.length > 0
                  ? ps.weather.map(w => (
                    <span key={w} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">{w}</span>
                  ))
                  : <span className="text-sm text-stone-400 italic">Not recorded</span>
                }
              </div>
            </div>
            <BoolField label="PPE Confirmed"   value={ps.ppeConfirmed} />
            <BoolField label="Fit for Work"    value={ps.fitForWork} />
            <BoolField label="Using Machinery" value={ps.usingMachinery} />
          </div>

          {ps.siteHazards && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Site Hazards</p>
              <p className="text-sm text-stone-900 whitespace-pre-wrap">{ps.siteHazards}</p>
            </div>
          )}

          {ps.usingMachinery && mc && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Machinery Pre-Start</p>

              {(() => {
                const machine = ps.machineId ? vehicles.find(v => v.id === ps.machineId) : null
                if (!machine) return null
                return (
                  <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 space-y-0.5">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Machine</p>
                    <p className="text-sm font-medium text-stone-900">{machine.make} {machine.model}</p>
                    {machine.registration && <p className="text-xs text-stone-500">{machine.registration}</p>}
                    {mc.hours_today && (
                      <p className="text-xs text-stone-500">Meter reading at submission: <span className="font-semibold text-stone-700">{mc.hours_today} hrs</span></p>
                    )}
                  </div>
                )
              })()}

              <div className="rounded-lg border border-stone-200 overflow-hidden divide-y divide-stone-100">
                {CHECKLIST_ITEMS.map(item => (
                  <div key={item.key} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-stone-700 flex-1 pr-4">{item.label}</span>
                    {checkLabel(mc[item.key] ?? '', item.key === 'faults_concerns')}
                  </div>
                ))}
              </div>

              {mc.greased_why_not && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Why not greased</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{mc.greased_why_not}</p>
                </div>
              )}

              {mc.damage_description && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-0.5">Damage description</p>
                  <p className="text-sm text-red-900 whitespace-pre-wrap">{mc.damage_description}</p>
                </div>
              )}
            </div>
          )}

          {ps.notes && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-stone-900 whitespace-pre-wrap">{ps.notes}</p>
            </div>
          )}

          {/* Photos */}
          {ps.photoPaths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                Photos ({ps.photoPaths.length})
              </p>
              {detailPhotoUrls.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {detailPhotoUrls.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Photo ${i + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-stone-200 hover:opacity-90 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-400 italic">Loading photos…</p>
              )}
            </div>
          )}

          {/* Admin delete */}
          {isAdmin && (
            <div className="pt-3 border-t border-stone-100">
              {confirmDeleteDetail ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-stone-600">Delete this pre-start record permanently?</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(ps.id)}
                    disabled={deleting}
                    className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setConfirmDeleteDetail(false); setDeleteError(null) }}
                    className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    Cancel
                  </button>
                  {deleteError && <span className="text-sm text-red-500">{deleteError}</span>}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteDetail(true)}
                  className="text-sm text-stone-400 hover:text-red-500 transition-colors"
                >
                  Delete record
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Form view ──────────────────────────────────────────────────────────────

  if (view === 'new') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setView('list')}
            className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Pre-starts
          </button>
          <span className="text-stone-300">/</span>
          <h2 className="text-lg font-semibold text-stone-900">New pre-start</h2>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-6">

          {/* Site + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Site *</label>
              <select
                value={siteId}
                onChange={e => setSiteId(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-400 focus:outline-none"
              >
                <option value="">— Select site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Date *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-stone-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Crew present */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Crew Present</label>
            {staff.length === 0 ? (
              <p className="text-sm text-stone-400 italic">No staff in directory</p>
            ) : (
              <div className="rounded-lg border border-stone-200 max-h-48 overflow-y-auto divide-y divide-stone-50">
                {staff.map(s => (
                  <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-stone-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={crewPresent.includes(s.full_name)}
                      onChange={() => toggleCrew(s.full_name)}
                      className="h-4 w-4 rounded border-stone-300 text-green-700 focus:ring-green-600"
                    />
                    <span className="text-sm text-stone-800">{s.full_name}</span>
                  </label>
                ))}
              </div>
            )}
            {crewPresent.length > 0 && (
              <p className="text-xs text-stone-500">{crewPresent.length} selected: {crewPresent.join(', ')}</p>
            )}
          </div>

          {/* Weather */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Weather</label>
            <div className="flex flex-wrap gap-2">
              {WEATHER_OPTIONS.map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggleWeather(w)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    weather.includes(w)
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Hazards */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Any hazards identified on site?
            </label>
            <textarea
              value={siteHazards}
              onChange={e => setSiteHazards(e.target.value)}
              placeholder="Describe any hazards identified…"
              rows={2}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none resize-none"
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">PPE being worn?</label>
              <YesNo value={ppeConfirmed} onChange={setPpeConfirmed} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">All crew fit for work?</label>
              <YesNo value={fitForWork} onChange={setFitForWork} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Using machinery today?</label>
              <YesNo value={usingMachinery} onChange={setUsingMachinery} />
            </div>
          </div>

          {/* Machinery section */}
          {usingMachinery && (
            <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Machinery Pre-Start Check</p>

              {/* Machine selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Select Machine</label>
                {machineryVehicles.length === 0 ? (
                  <p className="text-sm text-stone-400 italic">
                    No machinery in fleet. Add vehicles with type &quot;Machinery&quot; in the Vehicles page.
                  </p>
                ) : (
                  <>
                    <select
                      value={machineId}
                      onChange={e => setMachineId(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-400 focus:outline-none"
                    >
                      <option value="">— Select machine —</option>
                      {machineryVehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.make} {v.model}{v.registration ? ` (${v.registration})` : ''}
                          {v.assigned_to ? ` — ${v.assigned_to}` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedVehicle?.current_hours != null && (
                      <p className="text-xs text-stone-500">
                        Current hours on this machine: <span className="font-semibold">{selectedVehicle.current_hours} hrs</span>
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Current meter reading */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  Current meter reading (hrs)
                </label>
                <input
                  type="number"
                  value={machineHours}
                  onChange={e => setMachineHours(e.target.value)}
                  placeholder="e.g. 1234.5"
                  min="0"
                  step="0.5"
                  className="w-36 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
                />
              </div>

              {/* Checklist */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Checklist</label>
                <div className="rounded-lg border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
                  {CHECKLIST_ITEMS.map(item => (
                    <div key={item.key} className="space-y-2 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-stone-700 flex-1">{item.label}</span>
                        <div className="flex gap-1 shrink-0">
                          {(['yes', 'no', 'na'] as const).map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setCheck(item.key, val)}
                              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                                checks[item.key] === val
                                  ? item.key === 'faults_concerns'
                                    ? val === 'no'  ? 'bg-green-600 text-white'
                                    : val === 'yes' ? 'bg-red-600 text-white'
                                    :                 'bg-stone-500 text-white'
                                    : val === 'yes' ? 'bg-green-600 text-white'
                                    : val === 'no'  ? 'bg-red-600 text-white'
                                    :                 'bg-stone-500 text-white'
                                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                              }`}
                            >
                              {val === 'na' ? 'N/A' : val === 'yes' ? 'Yes' : 'No'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Conditional: greased_today = No → Why not? */}
                      {item.key === 'greased_today' && checks.greased_today === 'no' && (
                        <textarea
                          value={greasedWhyNot}
                          onChange={e => setGreasedWhyNot(e.target.value)}
                          placeholder="Why wasn't the machine greased today? (required)"
                          rows={2}
                          className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-stone-900 placeholder:text-amber-400 focus:border-amber-400 focus:outline-none resize-none"
                        />
                      )}

                      {/* Conditional: no_new_damage = No → Describe the damage */}
                      {item.key === 'no_new_damage' && checks.no_new_damage === 'no' && (
                        <textarea
                          value={damageDescription}
                          onChange={e => setDamageDescription(e.target.value)}
                          placeholder="Describe the new damage found (required)"
                          rows={2}
                          className="w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-stone-900 placeholder:text-red-400 focus:border-red-400 focus:outline-none resize-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* General notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">General Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes…"
              rows={2}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none resize-none"
            />
          </div>

          {/* Photo upload */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Attach photos (optional) — e.g. damage, hazards
            </label>

            {/* Previews */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photoPreviews.map((url, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-20 object-cover rounded-lg border border-stone-200"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className={`flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer ${compressingPhotos ? 'opacity-50 pointer-events-none' : ''}`}>
                <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {compressingPhotos ? 'Compressing…' : 'Add photos'}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={handlePhotoSelect}
                  disabled={compressingPhotos}
                />
              </label>
              {pendingPhotos.length > 0 && (
                <span className="text-xs text-stone-400">{pendingPhotos.length} photo{pendingPhotos.length !== 1 ? 's' : ''} ready</span>
              )}
            </div>
          </div>

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || compressingPhotos}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Submitting…' : 'Submit pre-start'}
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Table not found banner */}
      {!tableExists && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The <code className="font-mono">pre_starts</code> table hasn&apos;t been created yet. Run the SQL migration to enable this feature.
        </div>
      )}

      {/* Supervisor: today's summary + filters */}
      {isSupervisorPlus && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-semibold text-stone-700">
                Today — {todaysPreStarts.length} pre-start{todaysPreStarts.length !== 1 ? 's' : ''}
              </h2>
              {todaysPreStarts.length > 0 && (
                <p className="text-xs text-stone-400 mt-0.5">
                  {todaysPreStarts.map(ps => ps.submitterName).join(', ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
            >
              New pre-start
            </button>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Filter</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-stone-500">From</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={e => setFilterFrom(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm text-stone-900 focus:border-stone-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-stone-500">To</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={e => setFilterTo(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm text-stone-900 focus:border-stone-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-stone-500">Site</label>
                <select
                  value={filterSite}
                  onChange={e => setFilterSite(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 focus:border-stone-400 focus:outline-none"
                >
                  <option value="">All sites</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterSite('') }}
                  className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={pdfGenerating || filteredPreStarts.length === 0}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition-colors"
                >
                  {pdfGenerating ? <Spinner /> : <PdfIcon />}
                  Export PDF
                </button>
              </div>
            </div>
            {pdfError && <p className="mt-2 text-xs text-red-600">{pdfError}</p>}
          </div>
        </div>
      )}

      {/* Leading hand: just new button */}
      {!isSupervisorPlus && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openNew}
            className="rounded-lg bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
          >
            New pre-start
          </button>
        </div>
      )}

      {/* Pre-starts list */}
      {deleteError && !confirmDeleteId && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
      )}
      {filteredPreStarts.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-14 text-center">
          <p className="text-sm font-medium text-stone-600">No pre-starts{isSupervisorPlus ? ' for this filter' : ' submitted yet'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
          {filteredPreStarts.map(ps => {
            const hasHazards = !!ps.siteHazards
            const issueFlags = [
              !ps.ppeConfirmed && 'PPE',
              !ps.fitForWork  && 'Fit for work',
            ].filter((x): x is string => Boolean(x))
            const isConfirming = confirmDeleteId === ps.id
            return (
              <div key={ps.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => openDetail(ps.id)}
                  className="flex-1 flex items-start gap-3 px-5 py-4 hover:bg-stone-50 transition-colors text-left min-w-0"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-stone-900 text-sm">{ps.siteName}</span>
                      <span className="text-xs text-stone-400">{fmtDate(ps.date)}</span>
                      {hasHazards && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Hazard</span>
                      )}
                      {issueFlags.map(f => (
                        <span key={f} className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{f} ✗</span>
                      ))}
                      {ps.photoPaths.length > 0 && (
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                          {ps.photoPaths.length} photo{ps.photoPaths.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-stone-400">
                      <span>Submitted by {ps.submitterName}</span>
                      {ps.crewPresent.length > 0 && (
                        <span>· {ps.crewPresent.length} crew</span>
                      )}
                      {ps.weather.length > 0 && (
                        <span>· {ps.weather.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  <svg className="h-4 w-4 text-stone-300 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>

                {/* Admin delete controls — sibling to nav button, never nested */}
                {isAdmin && (
                  <div className="flex items-center px-4 border-l border-stone-100 shrink-0">
                    {isConfirming ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500">Delete?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(ps.id)}
                          disabled={deleting}
                          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                        >
                          {deleting ? '…' : 'Yes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConfirmDeleteId(null); setDeleteError(null) }}
                          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(ps.id)}
                        className="text-xs text-stone-300 hover:text-red-500 transition-colors"
                      >
                        Delete
                      </button>
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

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-stone-900">{value}</p>
    </div>
  )
}

function BoolField({ label, value }: { label: string; value: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm font-medium ${value ? 'text-green-700' : 'text-red-600'}`}>
        {value ? 'Yes ✓' : 'No ✗'}
      </p>
    </div>
  )
}

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
          value ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
          !value ? 'bg-red-600 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
        }`}
      >
        No
      </button>
    </div>
  )
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
