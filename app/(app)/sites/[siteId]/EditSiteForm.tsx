'use client'

import { useActionState, useState } from 'react'
import { updateSite, deleteSite } from './actions'
import type { ActionState, EditState } from '@/types/actions'

interface Props {
  siteId: string
  name: string
  address: string | null
  clientContact: string | null
  hasClientExtras: boolean
  isAdmin?: boolean
}

export default function EditSiteForm({ siteId, name, address, clientContact, hasClientExtras, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [state, action, pending] = useActionState<EditState, FormData>(updateSite, null)
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteSite, null)

  if (!open || state?.success) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary hover:bg-surface-raised shrink-0"
      >
        Edit
      </button>
    )
  }

  return (
    <div className="mt-4 border-t border-border-subtle pt-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="site_id" value={siteId} />

        <div>
          <label htmlFor="site-name" className="block text-sm font-medium text-fg-secondary">
            Site name <span className="text-red-500">*</span>
          </label>
          <input
            id="site-name"
            name="name"
            type="text"
            required
            defaultValue={name}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-surface text-fg"
          />
        </div>

        <div>
          <label htmlFor="site-address" className="block text-sm font-medium text-fg-secondary">
            Address
          </label>
          <input
            id="site-address"
            name="address"
            type="text"
            defaultValue={address ?? ''}
            placeholder="e.g. 123 Main St, Perth WA 6000"
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-surface text-fg"
          />
        </div>

        <div>
          <label htmlFor="site-contact" className="block text-sm font-medium text-fg-secondary">
            Client contact
          </label>
          <input
            id="site-contact"
            name="client_contact"
            type="text"
            defaultValue={clientContact ?? ''}
            placeholder="e.g. Jane Smith — 0400 000 000"
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-surface text-fg"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-fg-secondary">Client extras</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="has_client_extras"
                value="true"
                defaultChecked={hasClientExtras}
                className="h-4 w-4 rounded border-border text-accent-fg focus:ring-green-600"
              />
              <span className="text-xs text-fg-muted">Show in quant &amp; invoices</span>
            </label>
          </div>
        )}

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised"
          >
            Cancel
          </button>
        </div>
      </form>

      {isAdmin && (
        <div className="mt-4 pt-3 border-t border-border-subtle">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Delete site
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-fg-secondary">
                Permanently delete this site and all its stages, lots, and photos?
              </p>
              <div className="flex items-center gap-3">
                <form action={deleteAction}>
                  <input type="hidden" name="site_id" value={siteId} />
                  <button
                    type="submit"
                    disabled={deletePending}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deletePending ? 'Deleting…' : 'Yes, delete site'}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm text-fg-muted hover:text-fg-secondary"
                >
                  Cancel
                </button>
              </div>
              {deleteState?.error && (
                <p className="text-sm text-red-600">{deleteState.error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
