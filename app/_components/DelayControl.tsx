'use client'

import { useActionState, useState } from 'react'
import { DELAYED_BADGE_CLASS, delayedBadgeLabel } from '@/lib/lotStatus'
import type { ActionState } from '@/types/actions'

interface Props {
  delayed: boolean
  delayReason: string | null
  expectedCompletionDate: string | null
  canManage: boolean
  promptLabel: string
  setAction: (prev: ActionState, formData: FormData) => Promise<ActionState>
  clearAction: (prev: ActionState, formData: FormData) => Promise<ActionState>
  hiddenFields: Record<string, string>
}

export default function DelayControl({
  delayed, delayReason, expectedCompletionDate, canManage, promptLabel, setAction, clearAction, hiddenFields,
}: Props) {
  const [marking, setMarking] = useState(false)
  const [setState, setFormAction, setPending] = useActionState<ActionState, FormData>(setAction, null)
  const [clearState, clearFormAction, clearPending] = useActionState<ActionState, FormData>(clearAction, null)

  if (delayed) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            title={delayReason ?? undefined}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${DELAYED_BADGE_CLASS}`}
          >
            {delayedBadgeLabel(expectedCompletionDate)}
          </span>
          {canManage && (
            <form action={clearFormAction}>
              {Object.entries(hiddenFields).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <button
                type="submit"
                disabled={clearPending}
                className="text-xs font-medium text-fg-muted hover:text-fg-secondary disabled:opacity-50"
              >
                {clearPending ? 'Removing…' : 'Remove delay'}
              </button>
            </form>
          )}
        </div>
        {delayReason && <p className="text-xs text-fg-muted">Reason: {delayReason}</p>}
        {clearState?.error && <p className="text-xs text-red-600">{clearState.error}</p>}
      </div>
    )
  }

  if (!canManage) return null

  if (marking) {
    return (
      <form action={setFormAction} className="space-y-2 rounded-lg border border-border p-3 bg-surface-raised">
        {Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label className="block text-xs font-medium text-fg-secondary">{promptLabel}</label>
        <textarea
          name="delay_reason"
          required
          rows={2}
          autoFocus
          placeholder="e.g. Waiting on turf delivery"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
        />
        <div>
          <label className="block text-xs font-medium text-fg-secondary mb-1">Expected completion date (optional)</label>
          <input
            name="expected_completion_date"
            type="date"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
        {setState?.error && <p className="text-xs text-red-600">{setState.error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={setPending}
            className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {setPending ? 'Saving…' : 'Confirm delay'}
          </button>
          <button
            type="button"
            onClick={() => setMarking(false)}
            className="text-xs text-fg-muted hover:text-fg-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setMarking(true)}
      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised"
    >
      Mark as Delayed
    </button>
  )
}
