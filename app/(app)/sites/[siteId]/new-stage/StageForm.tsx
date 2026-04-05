'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createStage } from './actions'

type ActionState = { error: string } | null

interface Props {
  siteId: string
}

export default function StageForm({ siteId }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createStage,
    null
  )

  return (
    <form action={action} className="space-y-4">
      {/* Hidden field so the server action knows which site */}
      <input type="hidden" name="site_id" value={siteId} />

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-stone-700">
          Stage name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Stage 1, Stage 2A, North Precinct"
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Add stage'}
        </button>
        <Link
          href={`/sites/${siteId}`}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
