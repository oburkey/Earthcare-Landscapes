'use client'

import { Fragment, useActionState, useEffect, useState } from 'react'
import { createHouseType, updateHouseType, deleteHouseType } from './actions'
import type { MutationState } from '@/types/actions'

export type HouseTypeRow = {
  id: string
  developer: string
  name: string
  size: 'S' | 'M' | 'L'
  site_area: number | null
  turf_area: number | null
  softworks_area: number | null
  alfresco_area: number | null
}

const SIZE_BADGE: Record<string, string> = {
  S: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  M: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  L: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
}

function fmtArea(n: number | null): string {
  return n != null ? n.toLocaleString('en-AU', { maximumFractionDigits: 2 }) : '—'
}

const INPUT = 'block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-fg-secondary mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function HouseTypeFields({ h }: { h?: HouseTypeRow }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Design name" required>
          <input name="name" type="text" required defaultValue={h?.name ?? ''} placeholder="e.g. Billie Jean" className={INPUT} />
        </Field>
        <Field label="Size" required>
          <select name="size" required defaultValue={h?.size ?? 'S'} className={INPUT}>
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Site area (m²)">
          <input name="site_area" type="number" min={0} step={0.01} defaultValue={h?.site_area ?? ''} className={INPUT} />
        </Field>
        <Field label="Turf area (m²)">
          <input name="turf_area" type="number" min={0} step={0.01} defaultValue={h?.turf_area ?? ''} className={INPUT} />
        </Field>
        <Field label="Softworks area (m²)">
          <input name="softworks_area" type="number" min={0} step={0.01} defaultValue={h?.softworks_area ?? ''} className={INPUT} />
        </Field>
        <Field label="Alfresco (m²)">
          <input name="alfresco_area" type="number" min={0} step={0.01} defaultValue={h?.alfresco_area ?? ''} className={INPUT} />
        </Field>
      </div>
      <Field label="Developer / client">
        <input name="developer" type="text" defaultValue={h?.developer ?? 'Providence'} placeholder="Providence" className={INPUT} />
      </Field>
    </div>
  )
}

function AddForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState<MutationState, FormData>(createHouseType, null)

  useEffect(() => {
    if (state && !state.error) onSuccess()
  }, [state, onSuccess])

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold text-fg-secondary mb-4">New house type</h3>
      <form action={action} className="space-y-4">
        <HouseTypeFields />
        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Add house type'}
        </button>
      </form>
    </div>
  )
}

function EditRow({ h, onDone }: { h: HouseTypeRow; onDone: () => void }) {
  const [updateState, updateAction, updatePending] = useActionState<MutationState, FormData>(updateHouseType, null)
  const [deleteState, deleteAction, deletePending] = useActionState<MutationState, FormData>(deleteHouseType, null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if ((updateState && !updateState.error) || (deleteState && !deleteState.error)) onDone()
  }, [updateState, deleteState, onDone])

  return (
    <div className="border-t border-border bg-surface-raised px-4 py-4 space-y-4">
      <form action={updateAction} className="space-y-4">
        <input type="hidden" name="id" value={h.id} />
        <HouseTypeFields h={h} />
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

      <div className="pt-2 border-t border-border-subtle">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-red-500 hover:text-red-700">
            Remove house type
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-fg-muted">Are you sure?</p>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={h.id} />
              <button
                type="submit"
                disabled={deletePending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletePending ? 'Removing…' : 'Yes, remove'}
              </button>
            </form>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-fg-muted hover:text-fg-secondary">
              Cancel
            </button>
          </div>
        )}
        {deleteState?.error && <p className="mt-2 text-sm text-red-600">{deleteState.error}</p>}
      </div>
    </div>
  )
}

export default function HouseTypesSettings({ houseTypes }: { houseTypes: HouseTypeRow[] }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const byDeveloper = new Map<string, HouseTypeRow[]>()
  for (const h of houseTypes) {
    const list = byDeveloper.get(h.developer) ?? []
    list.push(h)
    byDeveloper.set(h.developer, list)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <button
          onClick={() => { setShowAdd((v) => !v); setEditingId(null) }}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900"
        >
          {showAdd ? 'Cancel' : '+ Add house type'}
        </button>
      </div>

      {showAdd && <AddForm onSuccess={() => setShowAdd(false)} />}

      {houseTypes.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
          <p className="text-sm text-fg-muted">No house types yet.</p>
        </div>
      ) : (
        [...byDeveloper.entries()].map(([developer, rows]) => (
          <div key={developer} className="space-y-3">
            <h2 className="text-sm font-semibold text-fg-secondary">{developer}</h2>
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-raised text-fg-muted">
                      <th className="text-left font-medium px-4 py-2 whitespace-nowrap">Design name</th>
                      <th className="text-center font-medium px-2 py-2 whitespace-nowrap">Size</th>
                      <th className="text-right font-medium px-2 py-2 whitespace-nowrap">Site area</th>
                      <th className="text-right font-medium px-2 py-2 whitespace-nowrap">Turf area</th>
                      <th className="text-right font-medium px-2 py-2 whitespace-nowrap">Softworks area</th>
                      <th className="text-right font-medium px-2 py-2 whitespace-nowrap">Alfresco</th>
                      <th className="pr-4 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].sort((a, b) => a.name.localeCompare(b.name)).map((h) => (
                      <Fragment key={h.id}>
                        <tr className="border-b border-border-subtle hover:bg-surface-raised/60">
                          <td className="px-4 py-2.5 font-medium text-fg whitespace-nowrap">{h.name}</td>
                          <td className="px-2 py-2.5 text-center">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SIZE_BADGE[h.size]}`}>{h.size}</span>
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-fg-secondary">{fmtArea(h.site_area)}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-fg-secondary">{fmtArea(h.turf_area)}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-fg-secondary">{fmtArea(h.softworks_area)}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-fg-secondary">{fmtArea(h.alfresco_area)}</td>
                          <td className="pr-4 py-2.5 text-right">
                            <button
                              onClick={() => { setEditingId(editingId === h.id ? null : h.id); setShowAdd(false) }}
                              className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-raised"
                            >
                              {editingId === h.id ? 'Close' : 'Edit'}
                            </button>
                          </td>
                        </tr>
                        {editingId === h.id && (
                          <tr>
                            <td colSpan={7} className="p-0">
                              <EditRow h={h} onDone={() => setEditingId(null)} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
