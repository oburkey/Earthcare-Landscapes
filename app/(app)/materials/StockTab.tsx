'use client'

import { useActionState, useState } from 'react'
import { updateSiteStockItem, addSiteStockItem } from './stock-actions'
import { STOCK_GROUPS, type StockGroup } from './stock-constants'
import type { ActionState } from '@/types/actions'

export type StockItemRow = {
  id: string
  materialTypeId: string
  name: string
  unit: string
  stockGroup: string
  quantity: number
  lastUpdatedByName: string | null
  lastUpdateSource: string | null
  lastUpdateLot: string | null
  updatedAt: string | null
}

export type MaterialTypeOption = {
  id: string
  name: string
  unit: string
  stockGroup: string
}

export type SiteOption = { id: string; name: string }

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Human-readable "how this got here" caption per row, based on the source
// the last write recorded. Legacy/migrated rows have no source at all.
function updateCaption(row: StockItemRow): string | null {
  const date = fmtDate(row.updatedAt)
  if (row.lastUpdateSource === 'quant_deduction') {
    return `Updated from Lot ${row.lastUpdateLot ?? '?'} quant sheet${date ? ` ${date}` : ''}`
  }
  if (row.lastUpdateSource === 'order_delivery') {
    return `Updated from order delivery${date ? ` ${date}` : ''}`
  }
  if (row.lastUpdateSource === 'manual') {
    return row.lastUpdatedByName
      ? `Manually updated by ${row.lastUpdatedByName}${date ? ` ${date}` : ''}`
      : (date ? `Manually updated ${date}` : null)
  }
  return date ? `Last updated ${date}` : null
}

function StockItemCard({ siteId, item, canEdit }: {
  siteId: string; item: StockItemRow; canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateSiteStockItem(prev, formData)
      if (!result) setEditing(false)
      return result
    },
    null
  )

  const caption = updateCaption(item)

  if (editing) {
    return (
      <div className="rounded-lg border border-border p-3 bg-surface-raised">
        <p className="text-xs font-medium text-fg-muted mb-1.5">{item.name}</p>
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="material_type_id" value={item.materialTypeId} />
          <input
            name="value" type="number" step="0.01" min="0" defaultValue={item.quantity} autoFocus
            className="w-24 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
          <span className="text-xs text-fg-muted">{item.unit}</span>
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
      <p className="text-xs font-medium text-fg-muted">{item.name}</p>
      <p className="mt-1 text-lg font-semibold text-fg">
        {item.quantity.toLocaleString('en-AU')} <span className="text-xs font-normal text-fg-muted">{item.unit}</span>
      </p>
      {caption && <p className="mt-1 text-[11px] text-fg-muted">{caption}</p>}
    </button>
  )
}

function AddMaterialControl({ siteId, options }: {
  siteId: string; options: MaterialTypeOption[]
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await addSiteStockItem(prev, formData)
      if (!result) setOpen(false)
      return result
    },
    null
  )

  if (options.length === 0) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-border p-3 text-left text-xs font-medium text-fg-muted hover:bg-surface-raised hover:text-fg-secondary"
      >
        + Add material
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-dashed border-border p-3 bg-surface-raised space-y-2 col-span-2 sm:col-span-1">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="site_id" value={siteId} />
        <select
          name="material_type_id" required defaultValue=""
          className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-green-600 focus:outline-none"
        >
          <option value="" disabled>Select material…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <input
          name="initial_quantity" type="number" step="0.01" min="0" placeholder="Starting qty (optional)"
          className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none"
        />
        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {pending ? 'Adding…' : 'Add'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-fg-muted hover:text-fg-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default function StockTab({ sites, stockItemsBySite, materialTypes, canEdit, isAdmin, tableExists }: {
  sites: SiteOption[]
  stockItemsBySite: Record<string, StockItemRow[]>
  materialTypes: MaterialTypeOption[]
  canEdit: boolean
  isAdmin: boolean
  tableExists: boolean
}) {
  const [activeSiteId, setActiveSiteId] = useState<string | null>(sites[0]?.id ?? null)

  if (!tableExists) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-fg-muted">
          The site stock tables haven&apos;t been created yet. Run the SQL migration to enable this tab.
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
  const items = stockItemsBySite[activeSite.id] ?? []
  const itemsByGroup = new Map<string, StockItemRow[]>()
  for (const item of items) {
    const list = itemsByGroup.get(item.stockGroup) ?? []
    list.push(item)
    itemsByGroup.set(item.stockGroup, list)
  }
  const addedMaterialTypeIds = new Set(items.map((i) => i.materialTypeId))

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

      {(STOCK_GROUPS as readonly StockGroup[]).map((group) => {
        const groupItems = itemsByGroup.get(group) ?? []
        const groupOptions = materialTypes.filter((m) => m.stockGroup === group && !addedMaterialTypeIds.has(m.id))
        if (groupItems.length === 0 && groupOptions.length === 0) return null

        return (
          <div key={group} className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <h2 className="text-sm font-semibold text-fg-secondary">{group}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {groupItems.map((item) => (
                <StockItemCard key={item.id} siteId={activeSite.id} item={item} canEdit={canEdit} />
              ))}
              {isAdmin && <AddMaterialControl siteId={activeSite.id} options={groupOptions} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}
