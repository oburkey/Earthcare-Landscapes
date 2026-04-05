'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateStage } from './actions'

type ActionState = { error?: string; success?: boolean } | null

interface Props {
  siteId: string
  stageId: string
  name: string
}

export default function EditStageForm({ siteId, stageId, name }: Props) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<ActionState, FormData>(updateStage, null)

  useEffect(() => {
    if (state?.success) setOpen(false)
  }, [state])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
      >
        Edit
      </button>
    )
  }

  return (
    <form action={action} className="flex items-center gap-2 flex-wrap">
      <input type="hidden" name="site_id"  value={siteId} />
      <input type="hidden" name="stage_id" value={stageId} />
      <input
        name="name"
        type="text"
        required
        defaultValue={name}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 w-44"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 shrink-0"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 shrink-0"
      >
        Cancel
      </button>
      {state?.error && (
        <p className="text-sm text-red-600 w-full">{state.error}</p>
      )}
    </form>
  )
}
