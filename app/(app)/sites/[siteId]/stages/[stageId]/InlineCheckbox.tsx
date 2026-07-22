'use client'

import { useOptimistic, useState, useTransition } from 'react'
import type { ActionState } from '@/types/actions'

interface Props {
  checked: boolean
  disabled: boolean
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  hiddenFields: Record<string, string>
  label?: string
}

// Optimistic checkbox for the stage table views — flips instantly on click,
// confirms in the background, and reverts on error. Uses useOptimistic (not
// local useState) so it can't be left showing a stale value if the
// background revalidatePath() in the action refreshes the page mid-toggle.
export default function InlineCheckbox({ checked, disabled, action, hiddenFields, label }: Props) {
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(checked)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    if (disabled || isPending) return
    const next = !optimisticChecked
    setError(null)
    startTransition(async () => {
      setOptimisticChecked(next)
      const fd = new FormData()
      for (const [k, v] of Object.entries(hiddenFields)) fd.set(k, v)
      fd.set('completed', String(next))
      const result = await action(null, fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <input
      type="checkbox"
      checked={optimisticChecked}
      disabled={disabled || isPending}
      onChange={toggle}
      aria-label={label}
      title={error ?? label}
      className="h-4 w-4 rounded border-border text-accent-fg focus:ring-green-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    />
  )
}
