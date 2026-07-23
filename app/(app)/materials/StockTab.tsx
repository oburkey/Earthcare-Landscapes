'use client'

import { useActionState, useState } from 'react'
import { updateSiteStock } from './stock-actions'
import type { StockField } from './stock-constants'
import type { ActionState } from '@/types/actions'

export type SiteStockRow = {
  siteId: string
  plants140mm: number
  plants200mm: number
  plants300mm: number
  plants35l: number
  plants90l: number
  mulchTonnes: number
  edgingMetres: number
  turfRolls: number
  drippersPacks: number
  lastUpdatedByName: string | null
  updatedAt: string | null
}

export type SiteOption = { id: string; name: string }

const FIELD_DEFS: { field: StockField; label: string; unit: string; step: string }[] = [
  { field: 'plants_140mm',   label: '140mm plants',    unit: 'plants',  step: '1' },
  { field: 'plants_200mm',   label: '200mm plants',    unit: 'plants',  step: '1' },
  { field: 'plants_300mm',   label: '300mm plants',    unit: 'plants',  step: '1' },
  { field: 'plants_35l',     label: '35 Litre plants', unit: 'plants',  step: '1' },
  { field: 'plants_90l',     label: '90 Litre plants', unit: 'plants',  step: '1' },
  { field: 'mulch_tonnes',   label: 'Mulch',            unit: 'tonnes', step: '0.1' },
  { field: 'edging_metres',  label: 'Edging',           unit: 'metres', step: '0.1' },
  { field: 'turf_rolls',     label: 'Turf',             unit: 'rolls',  step: '1' },
  { field: 'drippers_packs', label: 'Drippers/Retic',   unit: 'packs',  step: '1' },
]

function fieldValue(row: SiteStockRow | undefined, field: StockField): number {
  if (!row) return 0
  switch (field) {
    case 'plants_140mm':   return row.plants140mm
    case 'plants_200mm':   return row.plants200mm
    case 'plants_300mm':   return row.plants300mm
    case 'plants_35l':     return row.plants35l
    case 'plants_90l':     return row.plants90l
    case 'mulch_tonnes':   return row.mulchTonnes
    case 'edging_metres':  return row.edgingMetres
    case 'turf_rolls':     return row.turfRolls
    case 'drippers_packs': return row.drippersPacks
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StockFieldCard({
  siteId, field, label, unit, step, value, canEdit,
}: {
  siteId: string; field: StockField; label: string; unit: string; step: string
  value: number; canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateSiteStock(prev, formData)
      if (!result) setEditing(false)
      return result
    },
    null
  )

  if (editing) {
    return (
      <div className="rounded-lg border border-border p-3 bg-surface-raised">
        <p className="text-xs font-medium text-fg-muted mb-1.5">{label}</p>
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="field" value={field} />
          <input
            name="value" type="number" step={step} min="0" defaultValue={value} autoFocus
            className="w-24 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
          <span className="text-xs text-fg-muted">{unit}</span>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-fg-muted hover:text-fg-secondary"
          >
            Cancel
          </button>
        </form>
        {state?.error && <p className="mt-1.5 text-xs text-red-600">{state.error}</p>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => canEdit && setEditing(true)}
      disabled={!canEdit}
      className={`rounded-lg border border-border p-3 text-left ${canEdit ? 'hover:bg-surface-raised cursor-pointer' : 'cursor-default'}`}
    >
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-fg">
        {value.toLocaleString('en-AU')} <span className="text-xs font-normal text-fg-muted">{unit}</span>
      </p>
    </button>
  )
}

export default function StockTab({ sites, stockBySite, canEdit, tableExists }: {
  sites: SiteOption[]
  stockBySite: Record<string, SiteStockRow>
  canEdit: boolean
  tableExists: boolean
}) {
  const [activeSiteId, setActiveSiteId] = useState<string | null>(sites[0]?.id ?? null)

  if (!tableExists) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-fg-muted">
          The site stock table hasn&apos;t been created yet. Run the SQL migration to enable this tab.
        </p>
      </div>
    )
  }

  if (sites.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-fg-muted">No active sites.</p>
      </div>
    )
  }

  const activeSite = sites.find((s) => s.id === activeSiteId) ?? sites[0]
  const row = stockBySite[activeSite.id]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {sites.map((site) => (
          <button
            key={site.id}
            type="button"
            onClick={() => setActiveSiteId(site.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeSite.id === site.id
                ? 'bg-green-700 text-white'
                : 'text-fg-muted hover:bg-surface-raised'
            }`}
          >
            {site.name}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg-secondary">{activeSite.name} — current stock</h2>
          {row?.lastUpdatedByName && (
            <p className="text-xs text-fg-muted">
              Last updated by {row.lastUpdatedByName}{row.updatedAt ? ` on ${fmtDate(row.updatedAt)}` : ''}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FIELD_DEFS.map((f) => (
            <StockFieldCard
              key={f.field}
              siteId={activeSite.id}
              field={f.field}
              label={f.label}
              unit={f.unit}
              step={f.step}
              value={fieldValue(row, f.field)}
              canEdit={canEdit}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
