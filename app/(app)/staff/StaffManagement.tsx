'use client'

import { useActionState, useEffect, useState } from 'react'
import { createStaffMember, updateStaffMember, deleteStaffMember } from './actions'
import type { Role } from '@/types/database'

type ActionState = { error?: string; success?: string } | null

interface StaffMember {
  id: string
  full_name: string
  phone_number: string | null
  credentials: string[]
  role: Role
}

interface Props {
  staff: StaffMember[]
  canManage: boolean
  allowedRoles: Role[]
}

const ROLE_LABELS: Record<Role, string> = {
  worker:       'Worker',
  leading_hand: 'Leading Hand',
  supervisor:   'Supervisor',
  admin:        'Admin',
  client:       'Client',
}

const ROLE_BADGE: Record<Role, string> = {
  worker:       'bg-stone-100 text-stone-600',
  leading_hand: 'bg-amber-100 text-amber-700',
  supervisor:   'bg-blue-100 text-blue-700',
  admin:        'bg-purple-100 text-purple-700',
  client:       'bg-green-100 text-green-700',
}

export default function StaffManagement({ staff, canManage, allowedRoles }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Staff</h1>
        {canManage && (
          <button
            onClick={() => { setShowAdd((v) => !v); setEditingId(null) }}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900"
          >
            {showAdd ? 'Cancel' : '+ Add staff'}
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && canManage && (
        <AddForm allowedRoles={allowedRoles} onSuccess={() => setShowAdd(false)} />
      )}

      {/* List */}
      {staff.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-12 text-center">
          <p className="text-sm text-stone-500">No staff members yet.</p>
          {canManage && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-sm font-medium text-green-700 hover:underline"
            >
              Add the first staff member →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <div key={member.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-stone-900">{member.full_name || 'Unnamed'}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[member.role]}`}>
                      {ROLE_LABELS[member.role]}
                    </span>
                  </div>
                  {member.phone_number && (
                    <a href={`tel:${member.phone_number}`} className="mt-0.5 block text-sm text-stone-500 hover:text-stone-700">
                      {member.phone_number}
                    </a>
                  )}
                  {member.credentials.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {member.credentials.map((c, i) => (
                        <span key={i} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
                {canManage && (
                  <button
                    onClick={() => setEditingId(editingId === member.id ? null : member.id)}
                    className="ml-3 shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    {editingId === member.id ? 'Close' : 'Edit'}
                  </button>
                )}
              </div>

              {editingId === member.id && canManage && (
                <div className="border-t border-stone-100 px-4 py-4">
                  <EditForm
                    member={member}
                    allowedRoles={allowedRoles}
                    onSuccess={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddForm({ allowedRoles, onSuccess }: { allowedRoles: Role[]; onSuccess: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createStaffMember, null)

  useEffect(() => {
    if (state?.success) onSuccess()
  }, [state, onSuccess])

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-stone-800 mb-4">New staff member</h2>
      <form action={action} className="space-y-4">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="add-name" className="block text-sm font-medium text-stone-700">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              id="add-name"
              name="full_name"
              type="text"
              required
              placeholder="e.g. Jake Morrison"
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label htmlFor="add-phone" className="block text-sm font-medium text-stone-700">
              Phone number
            </label>
            <input
              id="add-phone"
              name="phone_number"
              type="tel"
              placeholder="e.g. 0400 000 000"
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
        </div>

        <div>
          <label htmlFor="add-role" className="block text-sm font-medium text-stone-700">
            Role
          </label>
          <select
            id="add-role"
            name="role"
            defaultValue="worker"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-white"
          >
            {allowedRoles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="add-credentials" className="block text-sm font-medium text-stone-700">
            Credentials
          </label>
          <p className="mt-0.5 text-xs text-stone-500">One per line (e.g. White Card, Forklift Ticket, First Aid)</p>
          <textarea
            id="add-credentials"
            name="credentials"
            rows={3}
            placeholder={'White Card\nForklift Ticket\nFirst Aid'}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Add staff member'}
        </button>
      </form>
    </div>
  )
}

function EditForm({
  member,
  allowedRoles,
  onSuccess,
}: {
  member: StaffMember
  allowedRoles: Role[]
  onSuccess: () => void
}) {
  const [updateState, updateAction, updatePending] = useActionState<ActionState, FormData>(updateStaffMember, null)
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteStaffMember, null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (updateState?.success || deleteState?.success) onSuccess()
  }, [updateState, deleteState, onSuccess])

  return (
    <div className="space-y-4">
      <form action={updateAction} className="space-y-4">
        <input type="hidden" name="member_id" value={member.id} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`name-${member.id}`} className="block text-sm font-medium text-stone-700">Full name</label>
            <input
              id={`name-${member.id}`}
              name="full_name"
              type="text"
              required
              defaultValue={member.full_name}
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label htmlFor={`phone-${member.id}`} className="block text-sm font-medium text-stone-700">Phone number</label>
            <input
              id={`phone-${member.id}`}
              name="phone_number"
              type="tel"
              defaultValue={member.phone_number ?? ''}
              placeholder="e.g. 0400 000 000"
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
        </div>

        <div>
          <label htmlFor={`role-${member.id}`} className="block text-sm font-medium text-stone-700">Role</label>
          <select
            id={`role-${member.id}`}
            name="role"
            defaultValue={member.role}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-white"
          >
            {allowedRoles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`creds-${member.id}`} className="block text-sm font-medium text-stone-700">Credentials</label>
          <p className="mt-0.5 text-xs text-stone-500">One per line</p>
          <textarea
            id={`creds-${member.id}`}
            name="credentials"
            rows={3}
            defaultValue={member.credentials.join('\n')}
            placeholder={'White Card\nForklift Ticket\nFirst Aid'}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
          />
        </div>

        {updateState?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{updateState.error}</p>
        )}
        {updateState?.success && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{updateState.success}</p>
        )}

        <button
          type="submit"
          disabled={updatePending}
          className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {updatePending ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {/* Delete */}
      <div className="pt-1 border-t border-stone-100">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Remove staff member
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-stone-600">Are you sure?</p>
            <form action={deleteAction}>
              <input type="hidden" name="member_id" value={member.id} />
              <button
                type="submit"
                disabled={deletePending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletePending ? 'Removing…' : 'Yes, remove'}
              </button>
            </form>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-stone-500 hover:text-stone-700">
              Cancel
            </button>
          </div>
        )}
        {deleteState?.error && (
          <p className="mt-2 text-sm text-red-600">{deleteState.error}</p>
        )}
      </div>
    </div>
  )
}
