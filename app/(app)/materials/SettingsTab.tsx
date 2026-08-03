'use client'

import { useActionState, useState } from 'react'
import { createConversionSetting, updateConversionSetting, deleteConversionSetting } from './settings-actions'
import PlantRatiosSettings, { type RatioRow, type SiteOption as PlantRatioSiteOption } from './PlantRatiosSettings'
import ConversionLinksSection from './ConversionLinksSection'
import MaterialTypesSettings, { type MaterialTypeRow } from './MaterialTypesSettings'
import { MATERIAL_UNITS } from './order-constants'
import type { ActionState } from '@/types/actions'

export type ConversionSettingRow = {
  id: string
  name: string
  unit_from: string
  unit_to: string
  conversion_rate: number
  wastage_pct: number
  notes: string | null
  default_unit_price: number | null
}

export type ConversionLinkRow = {
  id: string
  parentSettingId: string
  name: string
  rate: number
  unit: string
  stockField: string | null
  orderIndex: number
}

function ConversionForm({
  action, defaults, submitLabel, onCancel, idField,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  defaults: Partial<ConversionSettingRow>
  submitLabel: string
  onCancel?: () => void
  idField?: string
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)

  return (
    <form action={formAction} className="space-y-3">
      {idField && <input type="hidden" name="id" value={idField} />}
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">Name</label>
        <input
          name="name" type="text" required defaultValue={defaults.name ?? ''}
          placeholder="e.g. Mulch"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Converts from (unit)</label>
          <select
            name="unit_from" required defaultValue={defaults.unit_from ?? ''}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            <option value="" disabled>— Select unit —</option>
            {MATERIAL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Converts to (unit)</label>
          <select
            name="unit_to" required defaultValue={defaults.unit_to ?? ''}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            <option value="" disabled>— Select unit —</option>
            {MATERIAL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Rate (1 unit_from = X unit_to)</label>
          <input
            name="conversion_rate" type="number" step="0.0001" min="0" required defaultValue={defaults.conversion_rate ?? ''}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Wastage %</label>
          <input
            name="wastage_pct" type="number" step="0.01" min="0" defaultValue={defaults.wastage_pct ?? 0}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">
          Default price ($ per {defaults.unit_from || 'unit_from'})
        </label>
        <input
          name="default_unit_price" type="number" step="0.01" min="0" placeholder="Optional"
          defaultValue={defaults.default_unit_price ?? ''}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">Notes</label>
        <textarea
          name="notes" rows={2} defaultValue={defaults.notes ?? ''}
          placeholder="Optional"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
        />
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-muted hover:bg-surface-raised"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export default function SettingsTab({
  settings, isAdmin, tableExists,
  conversionLinks, conversionLinksTableExists,
  materialTypes, materialTypesTableExists,
  plantRatiosGlobal, plantRatiosOverrides, plantRatiosSites,
}: {
  settings: ConversionSettingRow[]
  isAdmin: boolean
  tableExists: boolean
  conversionLinks: ConversionLinkRow[]
  conversionLinksTableExists: boolean
  materialTypes: MaterialTypeRow[]
  materialTypesTableExists: boolean
  plantRatiosGlobal: RatioRow | null
  plantRatiosOverrides: RatioRow[]
  plantRatiosSites: PlantRatioSiteOption[]
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedSettingId, setExpandedSettingId] = useState<string | null>(null)

  async function addAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    const result = await createConversionSetting(prev, formData)
    if (!result) setAdding(false)
    return result
  }

  async function editAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    const result = await updateConversionSetting(prev, formData)
    if (!result) setEditingId(null)
    return result
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        {!tableExists ? (
          <p className="text-sm text-fg-muted">
            The material conversion settings table hasn&apos;t been created yet. Run the SQL migration to enable this section.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-fg-secondary">Material conversion rates</h2>
                <p className="mt-0.5 text-xs text-fg-muted">Used to convert ordered quantities into usable coverage.</p>
              </div>
              {isAdmin && !adding && (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-raised"
                >
                  + Add new conversion
                </button>
              )}
            </div>

            {settings.length === 0 && !adding && (
              <p className="text-sm text-fg-muted">No conversion rates configured yet.</p>
            )}

            <div className="space-y-2">
              {settings.map((s) => {
                if (editingId === s.id) {
                  return (
                    <div key={s.id} className="rounded-lg border border-border p-3 bg-surface-raised">
                      <ConversionForm
                        action={editAction}
                        defaults={s}
                        submitLabel="Save"
                        onCancel={() => setEditingId(null)}
                        idField={s.id}
                      />
                    </div>
                  )
                }
                const settingLinks = conversionLinks.filter((l) => l.parentSettingId === s.id)
                return (
                  <div key={s.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg-secondary truncate">{s.name}</p>
                        <p className="text-xs text-fg-muted">
                          1 {s.unit_from} → {s.conversion_rate} {s.unit_to} · {s.wastage_pct}% wastage
                        </p>
                        {isAdmin && s.default_unit_price != null && (
                          <p className="text-xs text-fg-muted">
                            Default price: ${s.default_unit_price.toFixed(2)}/{s.unit_from}
                          </p>
                        )}
                        {s.notes && <p className="mt-0.5 text-xs text-fg-muted italic">{s.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setExpandedSettingId((cur) => (cur === s.id ? null : s.id))}
                          className="rounded px-2 py-1 text-xs text-fg-muted hover:bg-surface-raised"
                        >
                          Linked materials{settingLinks.length > 0 ? ` (${settingLinks.length})` : ''}
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingId(s.id)}
                              className="rounded px-2 py-1 text-xs text-fg-muted hover:bg-surface-raised"
                            >
                              Edit
                            </button>
                            <form action={async (fd) => { await deleteConversionSetting(null, fd) }}>
                              <input type="hidden" name="id" value={s.id} />
                              <button type="submit" className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                                Delete
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </div>
                    {expandedSettingId === s.id && (
                      <div className="border-t border-border-subtle pt-2">
                        <ConversionLinksSection
                          settingId={s.id}
                          links={settingLinks}
                          materialTypes={materialTypes.filter((m) => m.isActive).map((m) => ({ id: m.id, name: m.name }))}
                          isAdmin={isAdmin}
                          tableExists={conversionLinksTableExists}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {adding && (
              <div className="rounded-lg border border-dashed border-border p-3 bg-surface-raised">
                <ConversionForm
                  action={addAction}
                  defaults={{ wastage_pct: 0 }}
                  submitLabel="Add conversion"
                  onCancel={() => setAdding(false)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {isAdmin && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-fg-secondary">Material Types</h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              The master list of trackable materials that drives orders, stock, and quant sheet stock deductions.
            </p>
          </div>
          {!materialTypesTableExists ? (
            <p className="text-sm text-fg-muted">
              The material types table hasn&apos;t been created yet. Run the SQL migration to enable this section.
            </p>
          ) : (
            <MaterialTypesSettings materialTypes={materialTypes} />
          )}
        </div>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-fg-secondary">Plant Ratios</h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              Plants-per-m² ratios and pot size splits used for plant quantity calculations.
            </p>
          </div>
          <PlantRatiosSettings
            global={plantRatiosGlobal}
            overrides={plantRatiosOverrides}
            sites={plantRatiosSites}
          />
        </div>
      )}
    </div>
  )
}
