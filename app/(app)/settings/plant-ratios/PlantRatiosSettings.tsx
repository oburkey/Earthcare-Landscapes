'use client'

import { useActionState, useState } from 'react'
import { saveGlobalRatios, saveSiteOverride, deleteSiteOverride } from './actions'
import type { ActionState } from '@/types/actions'

type PotSizeSplit = Record<string, number>

export type RatioRow = {
  id: string
  site_id: string | null
  front_ratio: number
  rear_ratio: number
  pot_size_split: PotSizeSplit
  updated_at: string | null
}

export type SiteOption = { id: string; name: string }

const DEFAULT_FRONT = 2.0
const DEFAULT_REAR = 1.75
const DEFAULT_SMALL_POT = 75
const DEFAULT_LARGE_POT = 25

function potValue(split: PotSizeSplit | null | undefined, key: string, fallback: number): number {
  const v = split?.[key]
  return typeof v === 'number' ? v : fallback
}

// ── Shared ratio + pot split form ─────────────────────────────────────────────

function RatioForm({
  action, defaults, submitLabel, onCancel, topSlot,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  defaults: { front: number; rear: number; small: number; large: number }
  submitLabel: string
  onCancel?: () => void
  topSlot?: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)
  const [small, setSmall] = useState(defaults.small)
  const [large, setLarge] = useState(defaults.large)
  const total = Math.round((small + large) * 100) / 100

  return (
    <form action={formAction} className="space-y-3">
      {topSlot}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Front ratio (plants/m²)</label>
          <input
            name="front_ratio" type="number" step="0.01" min="0" defaultValue={defaults.front}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Rear ratio (plants/m²)</label>
          <input
            name="rear_ratio" type="number" step="0.01" min="0" defaultValue={defaults.rear}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
      </div>

      <div>
        <p className="block text-xs font-medium text-stone-500 mb-1">Pot size split (%)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-stone-400 mb-1">130/140mm</label>
            <input
              name="pot_small" type="number" step="1" min="0" max="100" value={small}
              onChange={(e) => setSmall(Number(e.target.value))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">200mm</label>
            <input
              name="pot_large" type="number" step="1" min="0" max="100" value={large}
              onChange={(e) => setLarge(Number(e.target.value))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
        </div>
        <p className={`mt-1 text-xs ${total === 100 ? 'text-stone-400' : 'text-red-600'}`}>
          Total: {total}%{total !== 100 && ' — must equal 100%'}
        </p>
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || total !== 100}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlantRatiosSettings({ global, overrides, sites }: {
  global: RatioRow | null
  overrides: RatioRow[]
  sites: SiteOption[]
}) {
  const [addingOverride, setAddingOverride] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const overriddenSiteIds = new Set(overrides.map((o) => o.site_id))
  const availableSites = sites.filter((s) => !overriddenSiteIds.has(s.id))

  async function addOverrideAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    const result = await saveSiteOverride(prev, formData)
    if (!result) setAddingOverride(false)
    return result
  }

  async function editOverrideAction(prev: ActionState, formData: FormData): Promise<ActionState> {
    const result = await saveSiteOverride(prev, formData)
    if (!result) setEditingId(null)
    return result
  }

  return (
    <div className="space-y-5">
      {/* Global default */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-stone-800 mb-3">Global default</h2>
        <RatioForm
          action={saveGlobalRatios}
          defaults={{
            front: global?.front_ratio ?? DEFAULT_FRONT,
            rear: global?.rear_ratio ?? DEFAULT_REAR,
            small: potValue(global?.pot_size_split, '130mm', DEFAULT_SMALL_POT),
            large: potValue(global?.pot_size_split, '200mm', DEFAULT_LARGE_POT),
          }}
          submitLabel="Save defaults"
        />
      </div>

      {/* Site overrides */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-800">Site overrides</h2>
          {!addingOverride && availableSites.length > 0 && (
            <button
              type="button"
              onClick={() => setAddingOverride(true)}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              + Add site override
            </button>
          )}
        </div>

        {overrides.length === 0 && !addingOverride && (
          <p className="text-sm text-stone-400">No site-specific overrides — all sites use the global default.</p>
        )}

        {overrides.map((o) => {
          const site = sites.find((s) => s.id === o.site_id)

          if (editingId === o.id) {
            return (
              <div key={o.id} className="rounded-lg border border-stone-200 p-3 bg-stone-50">
                <p className="text-sm font-medium text-stone-700 mb-2">{site?.name ?? 'Unknown site'}</p>
                <RatioForm
                  action={editOverrideAction}
                  defaults={{
                    front: o.front_ratio,
                    rear: o.rear_ratio,
                    small: potValue(o.pot_size_split, '130mm', DEFAULT_SMALL_POT),
                    large: potValue(o.pot_size_split, '200mm', DEFAULT_LARGE_POT),
                  }}
                  submitLabel="Save"
                  onCancel={() => setEditingId(null)}
                  topSlot={<input type="hidden" name="site_id" value={o.site_id ?? ''} />}
                />
              </div>
            )
          }

          return (
            <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">{site?.name ?? 'Unknown site'}</p>
                <p className="text-xs text-stone-500">
                  Front {o.front_ratio} / Rear {o.rear_ratio} · Pots {potValue(o.pot_size_split, '130mm', DEFAULT_SMALL_POT)}% / {potValue(o.pot_size_split, '200mm', DEFAULT_LARGE_POT)}%
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingId(o.id)}
                  className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
                >
                  Edit
                </button>
                <form action={deleteSiteOverride}>
                  <input type="hidden" name="id" value={o.id} />
                  <button type="submit" className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          )
        })}

        {addingOverride && (
          <div className="rounded-lg border border-dashed border-stone-300 p-3 bg-stone-50">
            <RatioForm
              action={addOverrideAction}
              defaults={{ front: DEFAULT_FRONT, rear: DEFAULT_REAR, small: DEFAULT_SMALL_POT, large: DEFAULT_LARGE_POT }}
              submitLabel="Add override"
              onCancel={() => setAddingOverride(false)}
              topSlot={
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Site</label>
                  <select
                    name="site_id" required defaultValue=""
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                  >
                    <option value="" disabled>Select a site…</option>
                    {availableSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
