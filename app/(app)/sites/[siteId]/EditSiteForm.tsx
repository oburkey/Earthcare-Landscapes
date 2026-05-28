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
        className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 shrink-0"
      >
        Edit
      </button>
    )
  }

  return (
    <div className="mt-4 border-t border-stone-100 pt-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="site_id" value={siteId} />

        <div>
          <label htmlFor="site-name" className="block text-sm font-medium text-stone-700">
            Site name <span className="text-red-500">*</span>
          </label>
          <input
            id="site-name"
            name="name"
            type="text"
            required
            defaultValue={name}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>

        <div>
          <label htmlFor="site-address" className="block text-sm font-medium text-stone-700">
            Address
          </label>
          <input
            id="site-address"
            name="address"
            type="text"
            defaultValue={address ?? ''}
            placeholder="e.g. 123 Main St, Perth WA 6000"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>

        <div>
          <label htmlFor="site-contact" className="block text-sm font-medium text-stone-700">
            Client contact
          </label>
          <input
            id="site-contact"
            name="client_contact"
            type="text"
            defaultValue={clientContact ?? ''}
            placeholder="e.g. Jane Smith — 0400 000 000"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-700">Client extras</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="has_client_extras"
                value="true"
                defaultChecked={hasClientExtras}
                className="h-4 w-4 rounded border-stone-300 text-green-700 focus:ring-green-600"
              />
              <span className="text-xs text-stone-500">Show in quant &amp; invoices</span>
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
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
        </div>
      </form>

      {isAdmin && (
        <div className="mt-4 pt-3 border-t border-stone-100">
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
              <p className="text-sm text-stone-700">
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
                  className="text-sm text-stone-500 hover:text-stone-700"
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
