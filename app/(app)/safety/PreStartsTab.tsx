'use client'

import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { submitPreStart, getSafetyDocUrl, deletePreStart, updatePreStart } from './actions'
import { compressImage } from '@/lib/compressImage'
import { LOGO_DATA_URL } from '@/lib/pdfAssets'
import type { Role } from '@/types/database'
import type { PreStartRow, SiteOption, StaffOption, VehicleOption } from './SafetyView'

// ── Checklist definitions ─────────────────────────────────────────────────────

type ChecklistItem = {
  readonly key:              string
  readonly label:            string
  readonly inverted?:        boolean  // "yes" is the bad answer
  readonly blocksSubmission?: boolean // bad answer prevents submit (truck Q1)
}

const MACHINERY_CHECKLIST: readonly ChecklistItem[] = [
  { key: 'air_filters',       label: 'Have air filters been cleaned today?' },
  { key: 'pre_cleaner_bowl',  label: 'Has the air filter been checked and bowl emptied?' },
  { key: 'engine_fluids',     label: 'Have engine oil, coolant and hydraulic fluid levels been checked, no leaks?' },
  { key: 'battery_water',     label: 'Have battery, leads and water level been checked?' },
  { key: 'belts_hoses',       label: 'Have belts, hoses and battery condition/connections been checked?' },
  { key: 'greased_today',     label: 'Has the machine been greased today?' },
  { key: 'attachments_secure',label: 'Are buckets, forks, attachment pins and bolts secure?' },
  { key: 'lights_working',    label: 'Are work lights, beacon, taillights and reverse lights working?' },
  { key: 'seatbelt_controls', label: 'Is the seatbelt working, and are controls, horn and reverse beeper operational?' },
  { key: 'fire_extinguisher', label: 'Is a fire extinguisher present and not expired?' },
  { key: 'door_seals',        label: 'Does the door open and close correctly with seals undamaged?' },
  { key: 'tyre_pressure',     label: 'Have tyre pressures been checked and wheel nuts are secure?' },
  { key: 'machine_washed',    label: 'Has the machine been washed in the last week?' },
  { key: 'faults_concerns',   label: 'Are there any faults or concerns to report?', inverted: true },
]

const TRUCK_CHECKLIST: readonly ChecklistItem[] = [
  { key: 'fitness_to_drive',  label: 'Are you fit, drug and alcohol free to drive this vehicle?', blocksSubmission: true },
  { key: 'fluid_levels',      label: 'Have fluid levels been checked (oil, coolant, brake/clutch fluid)?' },
  { key: 'battery_water',     label: 'Have battery, leads and water level been checked?' },
  { key: 'wheels_tyres',      label: 'Have wheels, tyres and hubs been checked (tread, pressure, wheel nuts)?' },
  { key: 'lights_reflectors', label: 'Are all lights and reflectors working?' },
  { key: 'windscreen_wipers', label: 'Are windscreen, wipers and mirrors clean and undamaged?' },
  { key: 'fluid_leaks',       label: 'Any fluid leaks visible (oil, fuel, water, hydraulic)?', inverted: true },
  { key: 'warning_lights',    label: 'After starting — any warning lights remain on?', inverted: true },
  { key: 'truck_washed',      label: 'Has the truck been washed in the last week?' },
  { key: 'faults_concerns',   label: 'Are there any faults or concerns to report?', inverted: true },
]

const TRAILER_CHECKLIST: readonly ChecklistItem[] = [
  { key: 'tyres_checked',     label: 'Have all tyres been checked (tread, damage, inflation, including spares)?' },
  { key: 'mudguards',         label: 'Are mudguards and mudflaps securely fitted?' },
  { key: 'lights_indicators', label: 'Are all lights, indicators and reflectors working?' },
  { key: 'chassis_suspension',label: 'Visual check of chassis, body and suspension complete?' },
  { key: 'tow_hitch',         label: 'Are tow hitch, safety chains and tie down straps secure (chains crossed left-right)?' },
  { key: 'brakes_tested',     label: 'Have brakes been tested at low speed (apply and release)?' },
  { key: 'faults_concerns',   label: 'Are there any faults or concerns to report?', inverted: true },
]

// Kept only for rendering legacy pre-start records in the detail view
const OLD_MACHINERY_CHECKLIST: readonly ChecklistItem[] = [
  { key: 'no_new_damage',   label: 'Is the machine free of new damage since last use?' },
  { key: 'fluid_levels',    label: 'Are all fluid levels checked (fuel, oil, hydraulic)?' },
  { key: 'brakes_steering', label: 'Are brakes and steering operating correctly?' },
  { key: 'guards_safety',   label: 'Are all guards and safety devices in place?' },
  { key: 'seatbelt',        label: 'Is the seatbelt working and in good condition?' },
  { key: 'tyres_tracks',    label: 'Are tyres/tracks in good condition?' },
  { key: 'greased_today',   label: 'Has the machine been greased today?' },
  { key: 'faults_concerns', label: 'Are there any faults or concerns to report?', inverted: true },
]

const WEATHER_OPTIONS = ['Fine', 'Hot', 'Wet', 'Windy', 'Extreme heat'] as const

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckVal = 'yes' | 'no' | 'na' | ''

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultChecksFor(items: readonly ChecklistItem[]): Record<string, CheckVal> {
  return Object.fromEntries(items.map(i => [i.key, '' as CheckVal]))
}

function isBadAnswer(item: ChecklistItem, val: CheckVal): boolean {
  if (!val) return false
  return item.inverted ? val === 'yes' : val === 'no'
}

// Validate a checklist; returns first error string or null
function validateSection(
  items: readonly ChecklistItem[],
  checks: Record<string, CheckVal>,
  notes: Record<string, string>,
  sectionLabel: string,
): string | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const val = (checks[item.key] ?? '') as CheckVal
    if (!isBadAnswer(item, val)) continue
    if (item.blocksSubmission) {
      return 'Vehicle cannot be operated — please notify your supervisor immediately'
    }
    if (!notes[item.key]?.trim()) {
      return `${sectionLabel} question ${i + 1}: please describe what's wrong`
    }
  }
  return null
}

// Build JSON blob: { key: val, key_notes: note, ... }
function buildChecksJson(
  items: readonly ChecklistItem[],
  checks: Record<string, CheckVal>,
  notes: Record<string, string>,
  extra?: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = { ...extra }
  for (const item of items) {
    result[item.key] = checks[item.key] ?? ''
    const note = notes[item.key]?.trim()
    if (note) result[`${item.key}_notes`] = note
  }
  return result
}

function pdfCheckVal(val: string | undefined, inverted = false): string {
  if (val === 'yes') return inverted ? '<span style="color:#dc2626;font-weight:bold">Yes</span>' : '<span style="color:#16a34a;font-weight:bold">Yes</span>'
  if (val === 'no')  return inverted ? '<span style="color:#16a34a;font-weight:bold">No</span>'  : '<span style="color:#dc2626;font-weight:bold">No</span>'
  if (val === 'na')  return '<span style="color:#999">N/A</span>'
  return '<span style="color:#ccc">—</span>'
}

function pdfChecklistRows(items: readonly ChecklistItem[], checks: Record<string, string>): string {
  return items.map(item => {
    const val  = checks[item.key] ?? ''
    const note = checks[`${item.key}_notes`] ?? ''
    const bad  = isBadAnswer(item, val as CheckVal)
    return `<tr>
      <td style="padding:1.5px 6px 1.5px 0;font-size:7.5px;color:#444;border-bottom:1px solid #f0f0f0;">${item.label}${bad && note ? `<br><span style="color:#dc2626;font-size:7px;">${note}</span>` : ''}</td>
      <td style="padding:1.5px 0;font-size:7.5px;white-space:nowrap;border-bottom:1px solid #f0f0f0;text-align:right;">${pdfCheckVal(val, item.inverted)}</td>
    </tr>`
  }).join('')
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

function pdfEquipmentDetailRow(
  label: string,
  bgColor: string,
  borderColor: string,
  labelColor: string,
  infoHtml: string,
  items: readonly ChecklistItem[],
  checks: Record<string, string>,
  photosLine: string,
): string {
  return `<tr>
    <td colspan="9" style="padding:5px 8px 7px 8px;background:${bgColor};border-bottom:2px solid ${borderColor};">
      <div style="display:flex;gap:16px;align-items:flex-start;">
        <div style="min-width:160px;max-width:200px;flex-shrink:0;">
          <div style="font-size:7px;font-weight:bold;text-transform:uppercase;color:${labelColor};margin-bottom:3px;letter-spacing:0.05em;">${label}</div>
          ${infoHtml}
          ${photosLine}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:7px;font-weight:bold;text-transform:uppercase;color:${labelColor};margin-bottom:3px;letter-spacing:0.05em;">Pre-Start Checklist</div>
          <table style="width:100%;border-collapse:collapse;">
            <tbody>${pdfChecklistRows(items, checks)}</tbody>
          </table>
        </div>
      </div>
    </td>
  </tr>`
}

async function downloadPreStartsPdf(
  preStarts: PreStartRow[],
  vehicles: VehicleOption[],
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

  const rows = preStarts.map(ps => {
    const hazard = ps.siteHazards ? `<span class="warn">Yes</span>` : 'No'
    const equipmentUsed = [
      ps.usingMachinery && 'Machine',
      ps.usingTruck     && 'Truck',
      ps.usingTrailer   && 'Trailer',
    ].filter(Boolean).join(', ') || 'No'

    const summaryRow = `<tr>
      <td>${ps.date}</td>
      <td>${ps.siteName}</td>
      <td>${ps.submitterName}</td>
      <td>${ps.crewPresent.map(id => { const s = staff.find(m => m.id === id); return s ? s.first_name + ' ' + s.last_name : id }).join(', ') || '—'}</td>
      <td>${ps.weather.join(', ') || '—'}</td>
      <td>${hazard}</td>
      <td class="${ps.ppeConfirmed ? 'ok' : 'bad'}">${ps.ppeConfirmed ? '✓' : '✗'}</td>
      <td class="${ps.fitForWork ? 'ok' : 'bad'}">${ps.fitForWork ? '✓' : '✗'}</td>
      <td>${equipmentUsed}</td>
    </tr>`

    let detailRows = ''

    // Machinery detail
    if (ps.usingMachinery && ps.machineryChecks) {
      const mc      = ps.machineryChecks
      const machine = ps.machineId ? vehicles.find(v => v.id === ps.machineId) : null
      const isOld   = 'no_new_damage' in mc
      const items   = isOld ? OLD_MACHINERY_CHECKLIST : MACHINERY_CHECKLIST
      const photosLine = ps.photoPaths.length > 0
        ? `<div style="margin-top:4px;font-size:7.5px;color:#6b7280;">${ps.photoPaths.length} photo${ps.photoPaths.length !== 1 ? 's' : ''} attached</div>`
        : ''
      const infoHtml = [
        machine ? `<div style="font-size:8.5px;font-weight:bold;color:#111;">${machine.make} ${machine.model}</div>` : '',
        machine?.registration ? `<div style="font-size:7.5px;color:#555;margin-top:1px;">${machine.registration}</div>` : '',
        machine?.assigned_to  ? `<div style="font-size:7.5px;color:#555;">Location: ${machine.assigned_to}</div>` : '',
        mc.hours_today ? `<div style="font-size:7.5px;color:#555;margin-top:3px;">Meter reading: <strong>${mc.hours_today} hrs</strong></div>` : '',
        // Legacy notes
        isOld && mc.greased_why_not    ? `<div style="margin-top:4px;font-size:7.5px;"><b style="color:#d97706">Not greased:</b> ${mc.greased_why_not}</div>` : '',
        isOld && mc.damage_description ? `<div style="margin-top:3px;font-size:7.5px;"><b style="color:#dc2626">Damage:</b> ${mc.damage_description}</div>` : '',
      ].filter(Boolean).join('')
      detailRows += pdfEquipmentDetailRow('Machine', '#fffbeb', '#fde68a', '#92400e', infoHtml, items, mc, photosLine)
    }

    // Truck detail
    if (ps.usingTruck && ps.truckChecks) {
      const tc    = ps.truckChecks
      const truck = ps.truckId ? vehicles.find(v => v.id === ps.truckId) : null
      const infoHtml = [
        truck ? `<div style="font-size:8.5px;font-weight:bold;color:#111;">${truck.make} ${truck.model}</div>` : '',
        truck?.registration ? `<div style="font-size:7.5px;color:#555;margin-top:1px;">${truck.registration}</div>` : '',
        truck?.assigned_to  ? `<div style="font-size:7.5px;color:#555;">Location: ${truck.assigned_to}</div>` : '',
      ].filter(Boolean).join('')
      detailRows += pdfEquipmentDetailRow('Truck', '#eff6ff', '#bfdbfe', '#1e40af', infoHtml, TRUCK_CHECKLIST, tc, '')
    }

    // Trailer detail
    if (ps.usingTrailer && ps.trailerChecks) {
      detailRows += pdfEquipmentDetailRow('Trailer', '#f0fdf4', '#bbf7d0', '#166534', '<div style="font-size:8.5px;font-weight:bold;color:#111;">Trailer</div>', TRAILER_CHECKLIST, ps.trailerChecks, '')
    }

    return summaryRow + detailRows
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
      <tr><th>Date</th><th>Site</th><th>Submitted By</th><th>Crew</th><th>Weather</th><th>Hazards</th><th>PPE</th><th>Fit</th><th>Equipment</th></tr>
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

// ── UI helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function checkLabel(val: string, inverted = false) {
  if (val === 'yes') return <span className={`${inverted ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'} font-medium`}>Yes</span>
  if (val === 'no')  return <span className={`${inverted ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'} font-medium`}>No</span>
  if (val === '')    return <span className="text-fg-muted">—</span>
  return <span className="text-fg-muted">N/A</span>
}

// Checklist display in the detail view
function DetailChecklist({
  items,
  checks,
}: {
  items: readonly ChecklistItem[]
  checks: Record<string, string>
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden divide-y divide-border-subtle">
      {items.map(item => {
        const val  = checks[item.key] ?? ''
        const note = checks[`${item.key}_notes`] ?? ''
        const bad  = isBadAnswer(item, val as CheckVal)
        return (
          <div key={item.key} className="px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-fg-secondary flex-1 pr-4">{item.label}</span>
              {checkLabel(val, item.inverted)}
            </div>
            {bad && note && (
              <p className="mt-1 text-xs text-red-700 bg-red-50 rounded px-2 py-1">{note}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Checklist input in the form
function ChecklistSection({
  items,
  checks,
  notes,
  onCheck,
  onNote,
}: {
  items:   readonly ChecklistItem[]
  checks:  Record<string, CheckVal>
  notes:   Record<string, string>
  onCheck: (key: string, val: CheckVal) => void
  onNote:  (key: string, note: string) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
      {items.map(item => {
        const val     = (checks[item.key] ?? '') as CheckVal
        const bad     = isBadAnswer(item, val)
        const isBlock = bad && item.blocksSubmission
        return (
          <div key={item.key} className="space-y-2 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg-secondary flex-1">{item.label}</span>
              <div className="flex gap-1 shrink-0">
                {(['yes', 'no'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onCheck(item.key, v)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      val === v
                        ? item.inverted
                          ? v === 'yes' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                          : v === 'yes' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        : 'bg-surface-raised text-fg-muted hover:bg-surface-raised'
                    }`}
                  >
                    {v === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
            {isBlock && (
              <p className="rounded-lg bg-red-100 border border-red-300 px-3 py-2 text-sm font-medium text-red-800">
                Vehicle cannot be operated — please notify your supervisor immediately
              </p>
            )}
            {bad && !isBlock && (
              <textarea
                value={notes[item.key] ?? ''}
                onChange={e => onNote(item.key, e.target.value)}
                placeholder="What's wrong? (required)"
                rows={2}
                className="w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-fg placeholder:text-red-400 focus:border-red-400 focus:outline-none resize-none"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  preStarts:         PreStartRow[]
  onPreStartsChange: Dispatch<SetStateAction<PreStartRow[]>>
  sites:             SiteOption[]
  staff:             StaffOption[]
  vehicles:          VehicleOption[]
  role:              Role
  userId:            string
  userName:          string
  today:             string
  tableExists:       boolean
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

  const staffName = (id: string) => {
    const s = staff.find(m => m.id === id)
    return s ? `${s.first_name} ${s.last_name}` : id
  }
  const crewNames = (ids: string[]) => ids.map(staffName).join(', ')

  const machineryVehicles = vehicles.filter(v => v.vehicle_type === 'Machinery')
  const truckVehicles     = vehicles.filter(v => v.vehicle_type === 'Truck')

  // ── List / nav state ───────────────────────────────────────────────────────
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailPhotoUrls, setDetailPhotoUrls] = useState<string[]>([])

  // Filter state (supervisor+)
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

  // Machinery
  const [usingMachinery, setUsingMachinery]   = useState(false)
  const [machineId, setMachineId]             = useState('')
  const [machineHours, setMachineHours]       = useState('')
  const [machineChecks, setMachineChecks]     = useState<Record<string, CheckVal>>(defaultChecksFor(MACHINERY_CHECKLIST))
  const [machineNotes, setMachineNotes]       = useState<Record<string, string>>({})

  // Truck
  const [usingTruck, setUsingTruck]           = useState(false)
  const [truckId, setTruckId]                 = useState('')
  const [truckChecks, setTruckChecks]         = useState<Record<string, CheckVal>>(defaultChecksFor(TRUCK_CHECKLIST))
  const [truckNotes, setTruckNotes]           = useState<Record<string, string>>({})

  // Trailer
  const [usingTrailer, setUsingTrailer]       = useState(false)
  const [trailerChecks, setTrailerChecks]     = useState<Record<string, CheckVal>>(defaultChecksFor(TRAILER_CHECKLIST))
  const [trailerNotes, setTrailerNotes]       = useState<Record<string, string>>({})

  const [notes, setNotes]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [formError, setFormError]       = useState<string | null>(null)

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId]       = useState<string | null>(null)
  const [confirmDeleteDetail, setConfirmDeleteDetail] = useState(false)
  const [deleting, setDeleting]                     = useState(false)
  const [deleteError, setDeleteError]               = useState<string | null>(null)

  // Edit state (admin only)
  const [editMode, setEditMode]                   = useState(false)
  const [editDate, setEditDate]                   = useState('')
  const [editSiteId, setEditSiteId]               = useState('')
  const [editCrewPresent, setEditCrewPresent]     = useState<string[]>([])
  const [editWeather, setEditWeather]             = useState<string[]>([])
  const [editSiteHazards, setEditSiteHazards]     = useState('')
  const [editPpeConfirmed, setEditPpeConfirmed]   = useState(true)
  const [editFitForWork, setEditFitForWork]       = useState(true)
  const [editNotes, setEditNotes]                 = useState('')
  const [editSaving, setEditSaving]               = useState(false)
  const [editError, setEditError]                 = useState<string | null>(null)

  // Photo state
  const [pendingPhotos, setPendingPhotos]   = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews]   = useState<string[]>([])
  const [compressingPhotos, setCompressingPhotos] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // ── Computed ───────────────────────────────────────────────────────────────

  const filteredPreStarts = isSupervisorPlus
    ? preStarts.filter(ps => {
        if (filterSite && ps.siteId !== filterSite) return false
        if (filterFrom && ps.date < filterFrom) return false
        if (filterTo   && ps.date > filterTo)   return false
        return true
      })
    : preStarts

  const todaysPreStarts  = preStarts.filter(ps => ps.date === today)
  const selectedPreStart = detailId ? preStarts.find(ps => ps.id === detailId) : null
  const selectedMachine  = machineryVehicles.find(v => v.id === machineId)
  const selectedTruck    = truckVehicles.find(v => v.id === truckId)

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openNew() {
    photoPreviews.forEach(url => URL.revokeObjectURL(url))
    setSiteId(''); setDate(today); setCrewPresent([]); setWeather([])
    setSiteHazards(''); setPpeConfirmed(true); setFitForWork(true)
    setUsingMachinery(false); setMachineId(''); setMachineHours('')
    setMachineChecks(defaultChecksFor(MACHINERY_CHECKLIST)); setMachineNotes({})
    setUsingTruck(false); setTruckId('')
    setTruckChecks(defaultChecksFor(TRUCK_CHECKLIST)); setTruckNotes({})
    setUsingTrailer(false)
    setTrailerChecks(defaultChecksFor(TRAILER_CHECKLIST)); setTrailerNotes({})
    setNotes(''); setFormError(null)
    setPendingPhotos([]); setPhotoPreviews([])
    setView('new')
  }

  async function openDetail(id: string) {
    setDetailId(id)
    setDetailPhotoUrls([])
    setEditMode(false)
    setEditError(null)
    setView('detail')
    const ps = preStarts.find(p => p.id === id)
    if (ps && ps.photoPaths.length > 0) {
      const urls = await Promise.all(ps.photoPaths.map(path => getSafetyDocUrl(path)))
      setDetailPhotoUrls(urls.filter(Boolean))
    }
  }

  function toggleCrew(name: string) {
    setCrewPresent(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  function toggleWeather(w: string) {
    setWeather(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])
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
      const err = validateSection(MACHINERY_CHECKLIST, machineChecks, machineNotes, 'Machinery')
      if (err) { setFormError(err); return }
    }
    if (usingTruck) {
      const err = validateSection(TRUCK_CHECKLIST, truckChecks, truckNotes, 'Truck')
      if (err) { setFormError(err); return }
    }
    if (usingTrailer) {
      const err = validateSection(TRAILER_CHECKLIST, trailerChecks, trailerNotes, 'Trailer')
      if (err) { setFormError(err); return }
    }

    setSaving(true); setFormError(null)

    const fd = new FormData()
    fd.set('site_id',        siteId)
    fd.set('date',           date)
    fd.set('crew_present',   JSON.stringify(crewPresent))
    fd.set('weather',        JSON.stringify(weather))
    fd.set('site_hazards',   siteHazards)
    fd.set('ppe_confirmed',  String(ppeConfirmed))
    fd.set('fit_for_work',   String(fitForWork))
    fd.set('using_machinery',String(usingMachinery))
    fd.set('machine_id',     machineId)
    fd.set('hours_today',    machineHours)
    if (usingMachinery) {
      fd.set('machinery_checks', JSON.stringify(
        buildChecksJson(MACHINERY_CHECKLIST, machineChecks, machineNotes, { hours_today: machineHours })
      ))
    }
    fd.set('using_truck',  String(usingTruck))
    fd.set('truck_id',     truckId)
    if (usingTruck) {
      fd.set('truck_checks', JSON.stringify(buildChecksJson(TRUCK_CHECKLIST, truckChecks, truckNotes)))
    }
    fd.set('using_trailer', String(usingTrailer))
    if (usingTrailer) {
      fd.set('trailer_checks', JSON.stringify(buildChecksJson(TRAILER_CHECKLIST, trailerChecks, trailerNotes)))
    }
    fd.set('notes', notes)

    pendingPhotos.forEach((photo, i) => fd.append(`photo_${i}`, photo, photo.name))

    const result = await submitPreStart(fd)
    setSaving(false)

    if (result?.error) { setFormError(result.error); return }

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
      machineryChecks: usingMachinery
        ? buildChecksJson(MACHINERY_CHECKLIST, machineChecks, machineNotes, { hours_today: machineHours })
        : null,
      machineId:      usingMachinery ? machineId : null,
      usingTruck,
      truckId:        usingTruck ? truckId : null,
      truckChecks:    usingTruck ? buildChecksJson(TRUCK_CHECKLIST, truckChecks, truckNotes) : null,
      usingTrailer,
      trailerChecks:  usingTrailer ? buildChecksJson(TRAILER_CHECKLIST, trailerChecks, trailerNotes) : null,
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
    const result = await deletePreStart(id)
    setDeleting(false)
    if (result?.error) { setDeleteError(result.error); return }
    onPreStartsChange(prev => prev.filter(ps => ps.id !== id))
    setConfirmDeleteId(null)
    setConfirmDeleteDetail(false)
    setDetailId(null)
    setView('list')
  }

  function openEdit(ps: PreStartRow) {
    setEditDate(ps.date)
    setEditSiteId(ps.siteId)
    setEditCrewPresent(ps.crewPresent)
    setEditWeather(ps.weather)
    setEditSiteHazards(ps.siteHazards ?? '')
    setEditPpeConfirmed(ps.ppeConfirmed)
    setEditFitForWork(ps.fitForWork)
    setEditNotes(ps.notes ?? '')
    setEditError(null)
    setEditMode(true)
  }

  async function handleEditSave(id: string) {
    setEditSaving(true); setEditError(null)
    const result = await updatePreStart(id, {
      date:          editDate,
      siteId:        editSiteId,
      crewPresent:   editCrewPresent,
      weather:       editWeather,
      siteHazards:   editSiteHazards || null,
      ppeConfirmed:  editPpeConfirmed,
      fitForWork:    editFitForWork,
      notes:         editNotes || null,
    })
    setEditSaving(false)
    if (result?.error) { setEditError(result.error); return }
    onPreStartsChange(prev => prev.map(ps => ps.id !== id ? ps : {
      ...ps,
      date:         editDate,
      siteId:       editSiteId,
      siteName:     sites.find(s => s.id === editSiteId)?.name ?? ps.siteName,
      crewPresent:  editCrewPresent,
      weather:      editWeather,
      siteHazards:  editSiteHazards || null,
      ppeConfirmed: editPpeConfirmed,
      fitForWork:   editFitForWork,
      notes:        editNotes || null,
    }))
    setEditMode(false)
  }

  // ── Detail view ────────────────────────────────────────────────────────────

  if (view === 'detail' && selectedPreStart) {
    const ps = selectedPreStart
    const mc = ps.machineryChecks
    const isOldMachinery = mc ? 'no_new_damage' in mc : false

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setView('list')}
            className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Pre-starts
          </button>
          <span className="text-fg-muted">/</span>
          <h2 className="text-lg font-semibold text-fg">{fmtDate(ps.date)}</h2>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 space-y-5">

          {/* General info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Site"         value={ps.siteName} />
            <Field label="Date"         value={fmtDate(ps.date)} />
            <Field label="Submitted By" value={ps.submitterName} />
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-1">Crew Present</p>
              <p className="text-sm text-fg">
                {ps.crewPresent.length > 0 ? crewNames(ps.crewPresent) : <span className="text-fg-muted italic">None listed</span>}
              </p>
            </div>
          </div>

          {/* Weather + bool flags */}
          <div>
            <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-1">Weather</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {ps.weather.length > 0
                ? ps.weather.map(w => <span key={w} className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-fg-secondary">{w}</span>)
                : <span className="text-sm text-fg-muted italic">Not recorded</span>
              }
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <BoolField label="PPE Confirmed"   value={ps.ppeConfirmed} />
              <BoolField label="Fit for Work"    value={ps.fitForWork} />
              <BoolField label="Machinery"       value={ps.usingMachinery} />
              <BoolField label="Truck"           value={ps.usingTruck} />
              <BoolField label="Trailer"         value={ps.usingTrailer} />
            </div>
          </div>

          {ps.siteHazards && (
            <div>
              <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-1">Site Hazards</p>
              <p className="text-sm text-fg whitespace-pre-wrap">{ps.siteHazards}</p>
            </div>
          )}

          {/* Machinery section */}
          {ps.usingMachinery && mc && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Machinery Pre-Start</p>
              {(() => {
                const machine = ps.machineId ? vehicles.find(v => v.id === ps.machineId) : null
                if (!machine) return null
                return (
                  <div className="rounded-lg bg-surface-raised border border-border px-3 py-2 space-y-0.5">
                    <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-1">Machine</p>
                    <p className="text-sm font-medium text-fg">{machine.make} {machine.model}</p>
                    {machine.registration && <p className="text-xs text-fg-muted">{machine.registration}</p>}
                    {mc.hours_today && (
                      <p className="text-xs text-fg-muted">Meter reading at submission: <span className="font-semibold text-fg-secondary">{mc.hours_today} hrs</span></p>
                    )}
                  </div>
                )
              })()}
              <DetailChecklist items={isOldMachinery ? OLD_MACHINERY_CHECKLIST : MACHINERY_CHECKLIST} checks={mc} />
              {/* Legacy notes for old-format records */}
              {isOldMachinery && mc.greased_why_not && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 dark:bg-amber-900/20 dark:border-amber-800/40">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-0.5">Why not greased</p>
                  <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{mc.greased_why_not}</p>
                </div>
              )}
              {isOldMachinery && mc.damage_description && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 dark:bg-red-900/20 dark:border-red-800/40">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide mb-0.5">Damage description</p>
                  <p className="text-sm text-red-900 dark:text-red-100 whitespace-pre-wrap">{mc.damage_description}</p>
                </div>
              )}
            </div>
          )}

          {/* Truck section */}
          {ps.usingTruck && ps.truckChecks && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Truck Pre-Start</p>
              {(() => {
                const truck = ps.truckId ? vehicles.find(v => v.id === ps.truckId) : null
                if (!truck) return null
                return (
                  <div className="rounded-lg bg-surface-raised border border-border px-3 py-2 space-y-0.5">
                    <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-1">Truck</p>
                    <p className="text-sm font-medium text-fg">{truck.make} {truck.model}</p>
                    {truck.registration && <p className="text-xs text-fg-muted">{truck.registration}</p>}
                  </div>
                )
              })()}
              <DetailChecklist items={TRUCK_CHECKLIST} checks={ps.truckChecks} />
            </div>
          )}

          {/* Trailer section */}
          {ps.usingTrailer && ps.trailerChecks && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Trailer Pre-Start</p>
              <DetailChecklist items={TRAILER_CHECKLIST} checks={ps.trailerChecks} />
            </div>
          )}

          {ps.notes && (
            <div>
              <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-fg whitespace-pre-wrap">{ps.notes}</p>
            </div>
          )}

          {/* Photos */}
          {ps.photoPaths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-2">
                Photos ({ps.photoPaths.length})
              </p>
              {detailPhotoUrls.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {detailPhotoUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Photo ${i + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-border hover:opacity-90 transition-opacity" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-fg-muted italic">Loading photos…</p>
              )}
            </div>
          )}

          {/* Admin actions */}
          {isAdmin && (
            <div className="pt-3 border-t border-border-subtle">
              {editMode ? (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Edit record</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-fg-muted">Date</label>
                      <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-border focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-fg-muted">Site</label>
                      <select value={editSiteId} onChange={e => setEditSiteId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-border focus:outline-none">
                        <option value="">— Select site —</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-fg-muted">PPE Confirmed</label>
                      <div className="flex gap-2">
                        {([true, false] as const).map(v => (
                          <button key={String(v)} type="button" onClick={() => setEditPpeConfirmed(v)}
                            className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${editPpeConfirmed === v ? 'bg-stone-900 border-stone-900 text-white dark:bg-stone-700 dark:border-stone-700' : 'border-border text-fg-secondary hover:bg-surface-raised'}`}>
                            {v ? 'Yes' : 'No'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-fg-muted">Fit for Work</label>
                      <div className="flex gap-2">
                        {([true, false] as const).map(v => (
                          <button key={String(v)} type="button" onClick={() => setEditFitForWork(v)}
                            className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${editFitForWork === v ? 'bg-stone-900 border-stone-900 text-white dark:bg-stone-700 dark:border-stone-700' : 'border-border text-fg-secondary hover:bg-surface-raised'}`}>
                            {v ? 'Yes' : 'No'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-fg-muted">Weather</label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEATHER_OPTIONS.map(w => (
                        <button key={w} type="button"
                          onClick={() => setEditWeather(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${editWeather.includes(w) ? 'bg-stone-800 text-white dark:bg-stone-600' : 'bg-surface-raised text-fg-secondary hover:bg-surface-raised'}`}>
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-fg-muted">Crew Present</label>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {staff.map(s => (
                        <label key={s.id} className="flex items-center gap-1.5 text-sm text-fg-secondary cursor-pointer">
                          <input type="checkbox"
                            checked={editCrewPresent.includes(s.id)}
                            onChange={() => setEditCrewPresent(prev =>
                              prev.includes(s.id) ? prev.filter(n => n !== s.id) : [...prev, s.id]
                            )}
                            className="rounded border-border text-fg focus:ring-border" />
                          {s.first_name} {s.last_name}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-fg-muted">Site Hazards</label>
                    <textarea value={editSiteHazards} onChange={e => setEditSiteHazards(e.target.value)}
                      rows={2} placeholder="Describe any site hazards…"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-none" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-fg-muted">Notes</label>
                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                      rows={2} placeholder="Any notes…"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-none" />
                  </div>

                  {editError && <p className="text-sm text-red-600">{editError}</p>}
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => handleEditSave(ps.id)} disabled={editSaving}
                      className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors">
                      {editSaving ? 'Saving…' : 'Save changes'}
                    </button>
                    <button type="button" onClick={() => { setEditMode(false); setEditError(null) }}
                      className="text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => openEdit(ps)}
                    className="text-sm text-fg-muted hover:text-fg transition-colors">Edit record</button>
                  {confirmDeleteDetail ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm text-fg-secondary">Delete this pre-start record permanently?</span>
                      <button type="button" onClick={() => handleDelete(ps.id)} disabled={deleting}
                        className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors">
                        {deleting ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button type="button" onClick={() => { setConfirmDeleteDetail(false); setDeleteError(null) }}
                        className="text-sm text-fg-muted hover:text-fg-secondary transition-colors">Cancel</button>
                      {deleteError && <span className="text-sm text-red-500">{deleteError}</span>}
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDeleteDetail(true)}
                      className="text-sm text-fg-muted hover:text-red-500 transition-colors">Delete record</button>
                  )}
                </div>
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
          <button type="button" onClick={() => setView('list')}
            className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Pre-starts
          </button>
          <span className="text-fg-muted">/</span>
          <h2 className="text-lg font-semibold text-fg">New pre-start</h2>
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

          {/* Crew present */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Crew Present</label>
            {staff.length === 0 ? (
              <p className="text-sm text-fg-muted italic">No staff in directory</p>
            ) : (
              <div className="rounded-lg border border-border max-h-48 overflow-y-auto divide-y divide-border-subtle">
                {staff.map(s => (
                  <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-raised cursor-pointer">
                    <input type="checkbox" checked={crewPresent.includes(s.id)} onChange={() => toggleCrew(s.id)}
                      className="h-4 w-4 rounded border-border text-green-700 focus:ring-green-600" />
                    <span className="text-sm text-fg">{s.first_name} {s.last_name}</span>
                  </label>
                ))}
              </div>
            )}
            {crewPresent.length > 0 && (
              <p className="text-xs text-fg-muted">{crewPresent.length} selected: {crewNames(crewPresent)}</p>
            )}
          </div>

          {/* Weather */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Weather</label>
            <div className="flex flex-wrap gap-2">
              {WEATHER_OPTIONS.map(w => (
                <button key={w} type="button" onClick={() => toggleWeather(w)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    weather.includes(w) ? 'bg-stone-800 text-white dark:bg-stone-600' : 'bg-surface-raised text-fg-secondary hover:bg-surface-raised'
                  }`}>{w}</button>
              ))}
            </div>
          </div>

          {/* Hazards */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">
              Any hazards identified on site?
            </label>
            <textarea value={siteHazards} onChange={e => setSiteHazards(e.target.value)}
              placeholder="Describe any hazards identified…" rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-none" />
          </div>

          {/* PPE + Fit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">PPE being worn?</label>
              <YesNo value={ppeConfirmed} onChange={setPpeConfirmed} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">All crew fit for work?</label>
              <YesNo value={fitForWork} onChange={setFitForWork} />
            </div>
          </div>

          {/* Equipment toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Using machinery today?</label>
              <YesNo value={usingMachinery} onChange={setUsingMachinery} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Using a truck today?</label>
              <YesNo value={usingTruck} onChange={setUsingTruck} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Using a trailer today?</label>
              <YesNo value={usingTrailer} onChange={setUsingTrailer} />
            </div>
          </div>

          {/* ── Machinery pre-start ── */}
          {usingMachinery && (
            <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-900/20">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Machinery Pre-Start Check</p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Select Machine</label>
                {machineryVehicles.length === 0 ? (
                  <p className="text-sm text-fg-muted italic">No machinery in fleet. Add vehicles with type &quot;Machinery&quot; in the Vehicles page.</p>
                ) : (
                  <>
                    <select value={machineId} onChange={e => setMachineId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-border focus:outline-none">
                      <option value="">— Select machine —</option>
                      {machineryVehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.make} {v.model}{v.registration ? ` (${v.registration})` : ''}{v.assigned_to ? ` — ${v.assigned_to}` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedMachine?.current_hours != null && (
                      <p className="text-xs text-fg-muted">
                        Current hours on this machine: <span className="font-semibold">{selectedMachine.current_hours} hrs</span>
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Current meter reading (hrs)</label>
                <input type="number" value={machineHours} onChange={e => setMachineHours(e.target.value)}
                  placeholder="e.g. 1234.5" min="0" step="0.5"
                  className="w-36 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Checklist</label>
                <ChecklistSection
                  items={MACHINERY_CHECKLIST}
                  checks={machineChecks}
                  notes={machineNotes}
                  onCheck={(k, v) => setMachineChecks(prev => ({ ...prev, [k]: v }))}
                  onNote={(k, n)  => setMachineNotes(prev => ({ ...prev, [k]: n }))}
                />
              </div>
            </div>
          )}

          {/* ── Truck pre-start ── */}
          {usingTruck && (
            <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/60 dark:bg-blue-900/20">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Truck Pre-Start Check</p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Select Truck</label>
                {truckVehicles.length === 0 ? (
                  <p className="text-sm text-fg-muted italic">No trucks in fleet. Add vehicles with type &quot;Truck&quot; in the Vehicles page.</p>
                ) : (
                  <>
                    <select value={truckId} onChange={e => setTruckId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-border focus:outline-none">
                      <option value="">— Select truck —</option>
                      {truckVehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.make} {v.model}{v.registration ? ` (${v.registration})` : ''}{v.assigned_to ? ` — ${v.assigned_to}` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedTruck && (
                      <p className="text-xs text-fg-muted">{selectedTruck.make} {selectedTruck.model} selected</p>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Checklist</label>
                <ChecklistSection
                  items={TRUCK_CHECKLIST}
                  checks={truckChecks}
                  notes={truckNotes}
                  onCheck={(k, v) => setTruckChecks(prev => ({ ...prev, [k]: v }))}
                  onNote={(k, n)  => setTruckNotes(prev => ({ ...prev, [k]: n }))}
                />
              </div>
            </div>
          )}

          {/* ── Trailer pre-start ── */}
          {usingTrailer && (
            <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800/60 dark:bg-green-900/20">
              <p className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-wide">Trailer Pre-Start Check</p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Checklist</label>
                <ChecklistSection
                  items={TRAILER_CHECKLIST}
                  checks={trailerChecks}
                  notes={trailerNotes}
                  onCheck={(k, v) => setTrailerChecks(prev => ({ ...prev, [k]: v }))}
                  onNote={(k, n)  => setTrailerNotes(prev => ({ ...prev, [k]: n }))}
                />
              </div>
            </div>
          )}

          {/* General notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">General Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes…" rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-none" />
          </div>

          {/* Photo upload */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">
              Attach photos (optional) — e.g. damage, hazards
            </label>
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photoPreviews.map((url, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-20 object-cover rounded-lg border border-border" />
                    <button type="button" onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <label className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised transition-colors cursor-pointer ${compressingPhotos ? 'opacity-50 pointer-events-none' : ''}`}>
                <svg className="h-4 w-4 text-fg-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {compressingPhotos ? 'Compressing…' : 'Add photos'}
                <input ref={photoInputRef} type="file" accept="image/*" multiple className="sr-only"
                  onChange={handlePhotoSelect} disabled={compressingPhotos} />
              </label>
              {pendingPhotos.length > 0 && (
                <span className="text-xs text-fg-muted">{pendingPhotos.length} photo{pendingPhotos.length !== 1 ? 's' : ''} ready</span>
              )}
            </div>
          </div>

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleSubmit} disabled={saving || compressingPhotos}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60 transition-colors">
            {saving ? 'Submitting…' : 'Submit pre-start'}
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
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
          The <code className="font-mono">pre_starts</code> table hasn&apos;t been created yet. Run the SQL migration to enable this feature.
        </div>
      )}

      {isSupervisorPlus && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-semibold text-fg-secondary">
                Today — {todaysPreStarts.length} pre-start{todaysPreStarts.length !== 1 ? 's' : ''}
              </h2>
              {todaysPreStarts.length > 0 && (
                <p className="text-xs text-fg-muted mt-0.5">{todaysPreStarts.map(ps => ps.submitterName).join(', ')}</p>
              )}
            </div>
            <button type="button" onClick={openNew}
              className="rounded-lg bg-green-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-800 transition-colors">
              New pre-start
            </button>
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
                  disabled={pdfGenerating || filteredPreStarts.length === 0}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50 transition-colors">
                  {pdfGenerating ? <Spinner /> : <PdfIcon />}
                  Export PDF
                </button>
              </div>
            </div>
            {pdfError && <p className="mt-2 text-xs text-red-600">{pdfError}</p>}
          </div>
        </div>
      )}

      {!isSupervisorPlus && (
        <div className="flex justify-end">
          <button type="button" onClick={openNew}
            className="rounded-lg bg-green-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-800 transition-colors">
            New pre-start
          </button>
        </div>
      )}

      {deleteError && !confirmDeleteId && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
      )}

      {filteredPreStarts.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-14 text-center">
          <p className="text-sm font-medium text-fg-secondary">No pre-starts{isSupervisorPlus ? ' for this filter' : ' submitted yet'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
          {filteredPreStarts.map(ps => {
            const hasHazards = !!ps.siteHazards
            const issueFlags = [
              !ps.ppeConfirmed && 'PPE',
              !ps.fitForWork  && 'Fit for work',
            ].filter((x): x is string => Boolean(x))
            const isConfirming = confirmDeleteId === ps.id
            return (
              <div key={ps.id} className="flex items-stretch">
                <button type="button" onClick={() => openDetail(ps.id)}
                  className="flex-1 flex items-start gap-3 px-5 py-4 hover:bg-surface-raised transition-colors text-left min-w-0">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-fg text-sm">{ps.siteName}</span>
                      <span className="text-xs text-fg-muted">{fmtDate(ps.date)}</span>
                      {hasHazards && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Hazard</span>}
                      {issueFlags.map(f => (
                        <span key={f} className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">{f} ✗</span>
                      ))}
                      {(ps.usingMachinery || ps.usingTruck || ps.usingTrailer) && (
                        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-fg-muted">
                          {[ps.usingMachinery && 'Machine', ps.usingTruck && 'Truck', ps.usingTrailer && 'Trailer'].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {ps.photoPaths.length > 0 && (
                        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-fg-muted">
                          {ps.photoPaths.length} photo{ps.photoPaths.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-fg-muted">
                      <span>Submitted by {ps.submitterName}</span>
                      {ps.crewPresent.length > 0 && <span>· {ps.crewPresent.length} crew</span>}
                      {ps.weather.length > 0 && <span>· {ps.weather.join(', ')}</span>}
                    </div>
                  </div>
                  <svg className="h-4 w-4 text-fg-muted shrink-0 mt-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>

                {isAdmin && (
                  <div className="flex items-center px-4 border-l border-border-subtle shrink-0">
                    {isConfirming ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-fg-muted">Delete?</span>
                        <button type="button" onClick={() => handleDelete(ps.id)} disabled={deleting}
                          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors">
                          {deleting ? '…' : 'Yes'}
                        </button>
                        <button type="button" onClick={() => { setConfirmDeleteId(null); setDeleteError(null) }}
                          className="text-xs text-fg-muted hover:text-fg-secondary transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(ps.id)}
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

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-fg">{value}</p>
    </div>
  )
}

function BoolField({ label, value }: { label: string; value: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm font-medium ${value ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {value ? 'Yes ✓' : 'No ✗'}
      </p>
    </div>
  )
}

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-1.5">
      <button type="button" onClick={() => onChange(true)}
        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${value ? 'bg-green-600 text-white' : 'bg-surface-raised text-fg-muted hover:bg-surface-raised'}`}>
        Yes
      </button>
      <button type="button" onClick={() => onChange(false)}
        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${!value ? 'bg-red-600 text-white' : 'bg-surface-raised text-fg-muted hover:bg-surface-raised'}`}>
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
