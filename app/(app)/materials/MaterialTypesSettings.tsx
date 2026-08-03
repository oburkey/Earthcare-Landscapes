'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  createMaterialType, updateMaterialType, toggleMaterialTypeActive,
  moveMaterialTypeUp, moveMaterialTypeDown,
} from './material-types-actions'
import { STOCK_GROUPS, type StockGroup } from './stock-constants'

export type MaterialTypeRow = {
  id: string
  name: string
  unit: string
  stockGroup: string
  quantItemNames: string[]
  isActive: boolean
  orderIndex: number
}

// ── Row ───────────────────────────────────────────────────────────────────────

function MaterialTypeRowItem({ item, isFirst, isLast }: {
  item: MaterialTypeRow; isFirst: boolean; isLast: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editState, editAction, editPending] = useActionState(updateMaterialType, null)
  const [, startToggle] = useTransition()
  const [, startMove] = useTransition()

  if (editing) {
    return (
      <div className="px-4 py-3 bg-surface-raised border-b border-border-subtle">
        <form action={async (fd) => { await editAction(fd); setEditing(false) }} className="space-y-2">
          <input type="hidden" name="material_type_id" value={item.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              name="name" defaultValue={item.name} required placeholder="Material name"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
            <input
              name="unit" defaultValue={item.unit} required placeholder="Unit (e.g. plants, m², rolls)"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">
              Quant sheet item names (comma-separated, optional)
            </label>
            <input
              name="quant_item_names" defaultValue={item.quantItemNames.join(', ')}
              placeholder="e.g. Mulch Limestone 32mm, Limestone Mulch"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          {editState?.error && <p className="text-xs text-red-600">{editState.error}</p>}
          <div className="flex gap-2">
            <button
              type="submit" disabled={editPending}
              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {editPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button" onClick={() => setEditing(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-raised"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className={`px-4 py-2.5 border-b border-border-subtle ${!item.isActive ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 shrink-0">
          <form action={moveMaterialTypeUp}>
            <input type="hidden" name="material_type_id" value={item.id} />
            <input type="hidden" name="stock_group" value={item.stockGroup} />
            <button
              type="submit" disabled={isFirst}
              onClick={(e) => { e.preventDefault(); startMove(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await moveMaterialTypeUp(fd) }) }}
              className="flex items-center justify-center w-8 h-8 sm:w-5 sm:h-5 rounded text-fg-muted hover:text-fg-muted disabled:opacity-20"
            >
              <svg className="h-4 w-4 sm:h-3 sm:w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </button>
          </form>
          <form action={moveMaterialTypeDown}>
            <input type="hidden" name="material_type_id" value={item.id} />
            <input type="hidden" name="stock_group" value={item.stockGroup} />
            <button
              type="submit" disabled={isLast}
              onClick={(e) => { e.preventDefault(); startMove(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await moveMaterialTypeDown(fd) }) }}
              className="flex items-center justify-center w-8 h-8 sm:w-5 sm:h-5 rounded text-fg-muted hover:text-fg-muted disabled:opacity-20"
            >
              <svg className="h-4 w-4 sm:h-3 sm:w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </form>
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-sm text-fg-secondary truncate">{item.name}</span>
          {item.quantItemNames.length > 0 && (
            <p className="text-xs text-fg-muted truncate">from: {item.quantItemNames.join(', ')}</p>
          )}
        </div>

        <span className="hidden sm:block text-xs text-fg-muted shrink-0 w-16 text-center">{item.unit}</span>

        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <button
            type="button" onClick={() => setEditing(true)}
            className="rounded px-2 py-1 text-xs text-fg-muted hover:bg-surface-raised"
          >
            Edit
          </button>
          <form action={toggleMaterialTypeActive}>
            <input type="hidden" name="material_type_id" value={item.id} />
            <input type="hidden" name="is_active" value={String(item.isActive)} />
            <button
              type="submit"
              onClick={(e) => { e.preventDefault(); startToggle(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await toggleMaterialTypeActive(fd) }) }}
              className={`rounded px-2 py-1 text-xs font-medium ${item.isActive ? 'text-fg-muted hover:bg-surface-raised' : 'text-accent-fg hover:bg-accent-dim'}`}
            >
              {item.isActive ? 'Disable' : 'Enable'}
            </button>
          </form>
        </div>
      </div>

      <div className="sm:hidden flex items-center gap-3 mt-1.5 pl-10">
        <span className="text-xs text-fg-muted">{item.unit}</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button" onClick={() => setEditing(true)}
            className="rounded px-2 py-1 text-xs text-fg-muted hover:bg-surface-raised"
          >
            Edit
          </button>
          <form action={toggleMaterialTypeActive}>
            <input type="hidden" name="material_type_id" value={item.id} />
            <input type="hidden" name="is_active" value={String(item.isActive)} />
            <button
              type="submit"
              onClick={(e) => { e.preventDefault(); startToggle(async () => { const fd = new FormData(e.currentTarget.closest('form')!); await toggleMaterialTypeActive(fd) }) }}
              className={`rounded px-2 py-1 text-xs font-medium ${item.isActive ? 'text-fg-muted hover:bg-surface-raised' : 'text-accent-fg hover:bg-accent-dim'}`}
            >
              {item.isActive ? 'Disable' : 'Enable'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddMaterialTypeForm({ stockGroup }: { stockGroup: StockGroup }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createMaterialType, null)

  if (!open) {
    return (
      <button
        type="button" onClick={() => setOpen(true)}
        className="w-full px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-raised text-left border-t border-border-subtle"
      >
        + Add material
      </button>
    )
  }

  return (
    <div className="px-4 py-3 border-t border-border-subtle bg-surface-raised">
      <form action={async (fd) => { await action(fd); setOpen(false) }} className="space-y-2">
        <input type="hidden" name="stock_group" value={stockGroup} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            name="name" required placeholder="Material name"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
          <input
            name="unit" required placeholder="Unit (e.g. plants, m², rolls)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
        <input
          name="quant_item_names" placeholder="Quant sheet item names, comma-separated (optional)"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        <div className="flex gap-2">
          <button
            type="submit" disabled={pending}
            className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {pending ? 'Adding…' : 'Add material'}
          </button>
          <button
            type="button" onClick={() => setOpen(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-raised"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Group card ────────────────────────────────────────────────────────────────

function GroupCard({ group, items }: { group: StockGroup; items: MaterialTypeRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="px-4 py-3 bg-surface-raised border-b border-border">
        <h3 className="text-sm font-semibold text-fg-secondary">{group}</h3>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-fg-muted">No materials in this group yet.</p>
      ) : (
        items.map((item, i) => (
          <MaterialTypeRowItem key={item.id} item={item} isFirst={i === 0} isLast={i === items.length - 1} />
        ))
      )}
      <AddMaterialTypeForm stockGroup={group} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MaterialTypesSettings({ materialTypes }: { materialTypes: MaterialTypeRow[] }) {
  return (
    <div className="space-y-4">
      {(STOCK_GROUPS as readonly StockGroup[]).map((group) => (
        <GroupCard
          key={group}
          group={group}
          items={materialTypes.filter((m) => m.stockGroup === group)}
        />
      ))}
    </div>
  )
}
