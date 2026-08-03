'use client'

import { useActionState, useState } from 'react'
import { createConversionLink, updateConversionLink, deleteConversionLink } from './settings-actions'
import { MATERIAL_UNITS } from './order-constants'
import type { ConversionLinkRow } from './SettingsTab'
import type { ActionState } from '@/types/actions'

type MaterialTypeOption = { id: string; name: string }

function LinkForm({
  action, defaults, submitLabel, onCancel, topSlot, materialTypes,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  defaults: Partial<ConversionLinkRow>
  submitLabel: string
  onCancel?: () => void
  topSlot?: React.ReactNode
  materialTypes: MaterialTypeOption[]
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)

  return (
    <form action={formAction} className="space-y-2">
      {topSlot}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Name</label>
          <input
            name="name" type="text" required defaultValue={defaults.name ?? ''}
            placeholder="e.g. Crackerdust"
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Rate (per unit of primary)</label>
          <input
            name="rate" type="number" step="0.0001" min="0" required defaultValue={defaults.rate ?? ''}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-green-600 focus:outline-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Unit</label>
          <select
            name="unit" required defaultValue={defaults.unit ?? ''}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-green-600 focus:outline-none"
          >
            <option value="" disabled>— Select unit —</option>
            {MATERIAL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Stock material (optional)</label>
          <select
            name="stock_field" defaultValue={defaults.stockField ?? ''}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-green-600 focus:outline-none"
          >
            <option value="">— None —</option>
            {materialTypes.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-raised"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export default function ConversionLinksSection({ settingId, links, materialTypes, isAdmin, tableExists }: {
  settingId: string
  links: ConversionLinkRow[]
  materialTypes: MaterialTypeOption[]
  isAdmin: boolean
  tableExists: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function addAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    const result = await createConversionLink(prev, formData)
    if (!result) setAdding(false)
    return result
  }

  async function editAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    const result = await updateConversionLink(prev, formData)
    if (!result) setEditingId(null)
    return result
  }

  if (!tableExists) {
    return (
      <p className="text-xs text-fg-muted">
        Linked materials haven&apos;t been set up yet. Run the SQL migration to enable this.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {links.length === 0 && !adding && (
        <p className="text-xs text-fg-muted">No linked materials configured.</p>
      )}

      {links.map((l) => {
        if (editingId === l.id) {
          return (
            <div key={l.id} className="rounded-lg border border-border p-2 bg-surface-raised">
              <LinkForm
                action={editAction}
                defaults={l}
                submitLabel="Save"
                onCancel={() => setEditingId(null)}
                materialTypes={materialTypes}
                topSlot={
                  <>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="parent_setting_id" value={settingId} />
                  </>
                }
              />
            </div>
          )
        }
        return (
          <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-fg-secondary truncate">{l.name}</p>
              <p className="text-xs text-fg-muted">
                {l.rate} {l.unit} per unit{l.stockField ? ` · updates ${l.stockField}` : ''}
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingId(l.id)}
                  className="rounded px-2 py-1 text-xs text-fg-muted hover:bg-surface-raised"
                >
                  Edit
                </button>
                <form action={async (fd) => { await deleteConversionLink(null, fd) }}>
                  <input type="hidden" name="id" value={l.id} />
                  <button type="submit" className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </form>
              </div>
            )}
          </div>
        )
      })}

      {isAdmin && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-xs font-medium text-accent-fg hover:underline"
        >
          + Add linked material
        </button>
      )}

      {adding && (
        <div className="rounded-lg border border-dashed border-border p-2 bg-surface-raised">
          <LinkForm
            action={addAction}
            defaults={{}}
            submitLabel="Add"
            onCancel={() => setAdding(false)}
            materialTypes={materialTypes}
            topSlot={<input type="hidden" name="parent_setting_id" value={settingId} />}
          />
        </div>
      )}
    </div>
  )
}
