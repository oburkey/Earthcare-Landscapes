'use client'

import { useActionState, useEffect, useState } from 'react'
import { createVehicle, updateVehicle, deleteVehicle } from './actions'

type ActionState = { error?: string; success?: string } | null

interface Vehicle {
  id: string
  make: string
  model: string
  year: number | null
  registration: string | null
  assigned_to: string | null
  rego_expiry_date: string | null
  insurance_expiry_date: string | null
  last_service_date: string | null
  last_service_hours: number | null
  last_service_odometer: number | null
  next_service_due_date: string | null
  next_service_km: number | null
  next_service_hours: number | null
  notes: string | null
}

interface Props {
  vehicles: Vehicle[]
  today: string // ISO date string passed from server to avoid hydration mismatch
}

// ── Status logic ──────────────────────────────────────────────────────────────

type StatusLevel = 'red' | 'amber' | 'green'

function daysDiff(dateStr: string, todayStr: string): number {
  const today = new Date(todayStr)
  const target = new Date(dateStr)
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000)
}

function getVehicleStatus(v: Vehicle, today: string): StatusLevel {
  const dates = [v.rego_expiry_date, v.insurance_expiry_date, v.next_service_due_date].filter(Boolean) as string[]
  let worst: StatusLevel = 'green'
  for (const d of dates) {
    const diff = daysDiff(d, today)
    if (diff < 0) return 'red'
    if (diff <= 30) worst = 'amber'
  }
  return worst
}

const STATUS_DOT: Record<StatusLevel, { dot: string; label: string }> = {
  green: { dot: 'bg-green-500',  label: 'All good' },
  amber: { dot: 'bg-amber-400',  label: 'Due soon' },
  red:   { dot: 'bg-red-500',    label: 'Action needed' },
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function dateClass(dateStr: string | null | undefined, today: string): string {
  if (!dateStr) return 'text-stone-500'
  const diff = daysDiff(dateStr, today)
  if (diff < 0)  return 'text-red-600 font-semibold'
  if (diff <= 30) return 'text-amber-600 font-semibold'
  return 'text-stone-800'
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VehicleManagement({ vehicles, today }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Vehicles</h1>
        <button
          onClick={() => { setShowAdd((v) => !v); setEditingId(null) }}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900"
        >
          {showAdd ? 'Cancel' : '+ Add vehicle'}
        </button>
      </div>

      {showAdd && (
        <AddForm onSuccess={() => setShowAdd(false)} />
      )}

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-12 text-center">
          <p className="text-sm text-stone-500">No vehicles yet.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-3 text-sm font-medium text-green-700 hover:underline"
          >
            Add the first vehicle →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((vehicle) => {
            const status = getVehicleStatus(vehicle, today)
            const { dot, label } = STATUS_DOT[status]
            return (
              <div key={vehicle.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">

                {/* Card header */}
                <div className="flex items-start justify-between gap-3 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Status dot */}
                      <span title={label} className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${dot}`} />
                      <span className="text-sm font-semibold text-stone-900">
                        {vehicle.year ? `${vehicle.year} ` : ''}{vehicle.make} {vehicle.model}
                      </span>
                      {vehicle.registration && (
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-mono font-medium text-stone-700">
                          {vehicle.registration}
                        </span>
                      )}
                    </div>
                    {vehicle.assigned_to && (
                      <p className="mt-1 text-xs text-stone-500">
                        Assigned to <span className="font-medium text-stone-700">{vehicle.assigned_to}</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingId(editingId === vehicle.id ? null : vehicle.id)}
                    className="shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    {editingId === vehicle.id ? 'Close' : 'Edit'}
                  </button>
                </div>

                {/* Detail rows */}
                <div className="border-t border-stone-100 divide-y divide-stone-100">

                  {/* Service info */}
                  <div className="grid grid-cols-2 divide-x divide-stone-100">
                    <div className="px-4 py-3">
                      <p className="text-xs font-medium text-stone-400 mb-0.5">Last service</p>
                      <p className="text-sm text-stone-800">{fmt(vehicle.last_service_date)}</p>
                      {(vehicle.last_service_hours !== null || vehicle.last_service_odometer !== null) && (
                        <p className="text-xs text-stone-400 mt-0.5">
                          {[
                            vehicle.last_service_hours !== null ? `${vehicle.last_service_hours.toLocaleString()} hrs` : null,
                            vehicle.last_service_odometer !== null ? `${vehicle.last_service_odometer.toLocaleString()} km` : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-xs font-medium text-stone-400 mb-0.5">Next service</p>
                      <p className={`text-sm ${dateClass(vehicle.next_service_due_date, today)}`}>
                        {fmt(vehicle.next_service_due_date)}
                      </p>
                      {(vehicle.next_service_km !== null || vehicle.next_service_hours !== null) && (
                        <p className="text-xs text-stone-400 mt-0.5">
                          {[
                            vehicle.next_service_hours !== null ? `${vehicle.next_service_hours.toLocaleString()} hrs` : null,
                            vehicle.next_service_km !== null ? `${vehicle.next_service_km.toLocaleString()} km` : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Rego + insurance */}
                  <div className="grid grid-cols-2 divide-x divide-stone-100">
                    <div className="px-4 py-3">
                      <p className="text-xs font-medium text-stone-400 mb-0.5">Rego expiry</p>
                      <p className={`text-sm ${dateClass(vehicle.rego_expiry_date, today)}`}>
                        {fmt(vehicle.rego_expiry_date)}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-xs font-medium text-stone-400 mb-0.5">Insurance expiry</p>
                      <p className={`text-sm ${dateClass(vehicle.insurance_expiry_date, today)}`}>
                        {fmt(vehicle.insurance_expiry_date)}
                      </p>
                    </div>
                  </div>

                  {/* Notes */}
                  {vehicle.notes && (
                    <div className="px-4 py-3">
                      <p className="text-xs font-medium text-stone-400 mb-0.5">Notes</p>
                      <p className="text-sm text-stone-700 whitespace-pre-wrap">{vehicle.notes}</p>
                    </div>
                  )}
                </div>

                {/* Edit form */}
                {editingId === vehicle.id && (
                  <div className="border-t border-stone-200 bg-stone-50 px-4 py-4">
                    <EditForm vehicle={vehicle} onSuccess={() => setEditingId(null)} />
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

// ── Form fields component ─────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT = 'block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-white'

function VehicleFields({ v }: { v?: Vehicle }) {
  return (
    <div className="space-y-5">

      {/* Identity */}
      <div>
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Vehicle</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Make" required>
            <input name="make" type="text" required defaultValue={v?.make ?? ''} placeholder="Toyota" className={INPUT} />
          </Field>
          <Field label="Model" required>
            <input name="model" type="text" required defaultValue={v?.model ?? ''} placeholder="HiLux" className={INPUT} />
          </Field>
          <Field label="Year">
            <input name="year" type="number" min={1900} max={2100} defaultValue={v?.year ?? ''} placeholder="2022" className={INPUT} />
          </Field>
          <Field label="Registration">
            <input name="registration" type="text" defaultValue={v?.registration ?? ''} placeholder="1ABC 234" className={INPUT} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Assigned to">
            <input name="assigned_to" type="text" defaultValue={v?.assigned_to ?? ''} placeholder="e.g. John Smith or Site 3" className={INPUT} />
          </Field>
        </div>
      </div>

      {/* Compliance */}
      <div>
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Compliance</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rego expiry">
            <input name="rego_expiry_date" type="date" defaultValue={v?.rego_expiry_date ?? ''} className={INPUT} />
          </Field>
          <Field label="Insurance expiry">
            <input name="insurance_expiry_date" type="date" defaultValue={v?.insurance_expiry_date ?? ''} className={INPUT} />
          </Field>
        </div>
      </div>

      {/* Last service */}
      <div>
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Last service</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Date">
            <input name="last_service_date" type="date" defaultValue={v?.last_service_date ?? ''} className={INPUT} />
          </Field>
          <Field label="Hours (optional)">
            <input name="last_service_hours" type="number" min={0} step={0.1} defaultValue={v?.last_service_hours ?? ''} placeholder="e.g. 320" className={INPUT} />
          </Field>
          <Field label="Odometer km (optional)">
            <input name="last_service_odometer" type="number" min={0} defaultValue={v?.last_service_odometer ?? ''} placeholder="e.g. 45000" className={INPUT} />
          </Field>
        </div>
      </div>

      {/* Next service */}
      <div>
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Next service due</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Date">
            <input name="next_service_due_date" type="date" defaultValue={v?.next_service_due_date ?? ''} className={INPUT} />
          </Field>
          <Field label="Hours target (optional)">
            <input name="next_service_hours" type="number" min={0} step={0.1} defaultValue={v?.next_service_hours ?? ''} placeholder="e.g. 500" className={INPUT} />
          </Field>
          <Field label="Odometer target (optional)">
            <input name="next_service_km" type="number" min={0} defaultValue={v?.next_service_km ?? ''} placeholder="e.g. 55000" className={INPUT} />
          </Field>
        </div>
      </div>

      {/* Notes */}
      <Field label="Notes">
        <textarea name="notes" rows={2} defaultValue={v?.notes ?? ''} placeholder="e.g. Tow bar fitted, check tyre pressure weekly" className={`${INPUT} resize-none`} />
      </Field>

    </div>
  )
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createVehicle, null)

  useEffect(() => {
    if (state?.success) onSuccess()
  }, [state, onSuccess])

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-stone-800 mb-5">New vehicle</h2>
      <form action={action} className="space-y-5">
        <VehicleFields />
        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Add vehicle'}
        </button>
      </form>
    </div>
  )
}

// ── Edit form ─────────────────────────────────────────────────────────────────

function EditForm({ vehicle, onSuccess }: { vehicle: Vehicle; onSuccess: () => void }) {
  const [updateState, updateAction, updatePending] = useActionState<ActionState, FormData>(updateVehicle, null)
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteVehicle, null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (updateState?.success || deleteState?.success) onSuccess()
  }, [updateState, deleteState, onSuccess])

  return (
    <div className="space-y-5">
      <form action={updateAction} className="space-y-5">
        <input type="hidden" name="vehicle_id" value={vehicle.id} />
        <VehicleFields v={vehicle} />

        {updateState?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{updateState.error}</p>
        )}

        <button
          type="submit"
          disabled={updatePending}
          className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {updatePending ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="pt-2 border-t border-stone-200">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-red-500 hover:text-red-700">
            Remove vehicle
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-stone-600">Are you sure?</p>
            <form action={deleteAction}>
              <input type="hidden" name="vehicle_id" value={vehicle.id} />
              <button
                type="submit"
                disabled={deletePending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletePending ? 'Removing…' : 'Yes, remove'}
              </button>
            </form>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-stone-500 hover:text-stone-700">
              Cancel
            </button>
          </div>
        )}
        {deleteState?.error && (
          <p className="mt-2 text-sm text-red-600">{deleteState.error}</p>
        )}
      </div>
    </div>
  )
}
