'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createSite } from './actions'

type ActionState = { error: string } | null

export default function SiteForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createSite,
    null
  )

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-fg-secondary">
          Site name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Seniors Estate Mandurah"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-surface text-fg"
        />
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-fg-secondary">
          Address
        </label>
        <input
          id="address"
          name="address"
          type="text"
          placeholder="e.g. 12 Beach Rd, Mandurah WA 6210"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-surface text-fg"
        />
      </div>

      <div>
        <label htmlFor="client_contact" className="block text-sm font-medium text-fg-secondary">
          Client contact
        </label>
        <input
          id="client_contact"
          name="client_contact"
          type="text"
          placeholder="e.g. John Smith — 0412 345 678"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-surface text-fg"
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
          {pending ? 'Saving…' : 'Add site'}
        </button>
        <Link
          href="/sites"
          className="text-sm text-fg-muted hover:text-fg-secondary"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
