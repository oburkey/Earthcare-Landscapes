'use client'

import { useActionState, useEffect, useState } from 'react'
import { createStaffMember, updateStaffMember, deleteStaffMember } from './actions'
import type { Role } from '@/types/database'

type ActionState = { error?: string; success?: string } | null

interface StaffMember {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone_number: string | null
  credentials: string[]
  role: Role
  has_login: boolean
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
  worker:       'bg-surface-raised text-fg-muted',
  leading_hand: 'bg-amber-100 text-amber-700',
  supervisor:   'bg-blue-100 text-blue-700',
  admin:        'bg-purple-100 text-purple-700',
  client:       'bg-accent-dim text-accent-fg',
}

export default function StaffManagement({ staff, canManage, allowedRoles }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">Staff</h1>
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
        <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
          <p className="text-sm text-fg-muted">No staff members yet.</p>
          {canManage && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-sm font-medium text-accent-fg hover:underline"
            >
              Add the first staff member →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <div key={member.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-fg">
                      {member.first_name || member.last_name
                        ? `${member.first_name} ${member.last_name}`.trim()
                        : 'Unnamed'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[member.role]}`}>
                      {ROLE_LABELS[member.role]}
                    </span>
                    {!member.has_login && (
                      <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-fg-muted">
                        No login
                      </span>
                    )}
                  </div>
                  {member.email && (
                    <p className="mt-0.5 text-xs text-fg-muted">{member.email}</p>
                  )}
                  {member.phone_number && (
                    <a href={`tel:${member.phone_number}`} className="mt-0.5 block text-sm text-fg-muted hover:text-fg-secondary">
                      {member.phone_number}
                    </a>
                  )}
                  {member.credentials.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {member.credentials.map((c, i) => (
                        <span key={i} className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-fg-muted">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
                {canManage && (
                  <button
                    onClick={() => setEditingId(editingId === member.id ? null : member.id)}
                    className="ml-3 shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-raised"
                  >
                    {editingId === member.id ? 'Close' : 'Edit'}
                  </button>
                )}
              </div>

              {editingId === member.id && canManage && (
                <div className="border-t border-border-subtle px-4 py-4">
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
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-fg-secondary mb-4">New staff member</h2>
      <form action={action} className="space-y-4">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="add-first-name" className="block text-sm font-medium text-fg-secondary">
              First name <span className="text-red-500">*</span>
            </label>
            <input
              id="add-first-name"
              name="first_name"
              type="text"
              required
              placeholder="e.g. Jake"
              autoComplete="given-name"
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label htmlFor="add-last-name" className="block text-sm font-medium text-fg-secondary">
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              id="add-last-name"
              name="last_name"
              type="text"
              required
              placeholder="e.g. Morrison"
              autoComplete="family-name"
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="add-email" className="block text-sm font-medium text-fg-secondary">
              Email
            </label>
            <input
              id="add-email"
              name="email"
              type="email"
              placeholder="e.g. jake@earthcare.com.au"
              autoComplete="email"
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label htmlFor="add-phone" className="block text-sm font-medium text-fg-secondary">
              Phone number
            </label>
            <input
              id="add-phone"
              name="phone_number"
              type="tel"
              placeholder="e.g. 0400 000 000"
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
        </div>

        <div>
          <label htmlFor="add-role" className="block text-sm font-medium text-fg-secondary">
            Role
          </label>
          <select
            id="add-role"
            name="role"
            defaultValue="worker"
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            {allowedRoles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="add-credentials" className="block text-sm font-medium text-fg-secondary">
            Credentials
          </label>
          <p className="mt-0.5 text-xs text-fg-muted">One per line (e.g. White Card, Forklift Ticket, First Aid)</p>
          <textarea
            id="add-credentials"
            name="credentials"
            rows={3}
            placeholder={'White Card\nForklift Ticket\nFirst Aid'}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
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
            <label htmlFor={`first-${member.id}`} className="block text-sm font-medium text-fg-secondary">First name</label>
            <input
              id={`first-${member.id}`}
              name="first_name"
              type="text"
              required
              defaultValue={member.first_name}
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label htmlFor={`last-${member.id}`} className="block text-sm font-medium text-fg-secondary">Last name</label>
            <input
              id={`last-${member.id}`}
              name="last_name"
              type="text"
              required
              defaultValue={member.last_name}
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`email-${member.id}`} className="block text-sm font-medium text-fg-secondary">Email</label>
            <input
              id={`email-${member.id}`}
              name="email"
              type="email"
              defaultValue={member.email ?? ''}
              placeholder="e.g. jake@earthcare.com.au"
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label htmlFor={`phone-${member.id}`} className="block text-sm font-medium text-fg-secondary">Phone number</label>
            <input
              id={`phone-${member.id}`}
              name="phone_number"
              type="tel"
              defaultValue={member.phone_number ?? ''}
              placeholder="e.g. 0400 000 000"
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
        </div>

        <div>
          <label htmlFor={`role-${member.id}`} className="block text-sm font-medium text-fg-secondary">Role</label>
          <select
            id={`role-${member.id}`}
            name="role"
            defaultValue={member.role}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            {allowedRoles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`creds-${member.id}`} className="block text-sm font-medium text-fg-secondary">Credentials</label>
          <p className="mt-0.5 text-xs text-fg-muted">One per line</p>
          <textarea
            id={`creds-${member.id}`}
            name="credentials"
            rows={3}
            defaultValue={member.credentials.join('\n')}
            placeholder={'White Card\nForklift Ticket\nFirst Aid'}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
          />
        </div>

        {updateState?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{updateState.error}</p>
        )}
        {updateState?.success && (
          <p className="rounded-lg bg-accent-dim px-3 py-2 text-sm text-accent-fg">{updateState.success}</p>
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
      <div className="pt-1 border-t border-border-subtle">
        {member.has_login ? (
          <p className="text-xs text-fg-muted">
            This person has an active login account. Manage their account through the{' '}
            <a href="/users" className="underline hover:text-fg-secondary">Users page</a>.
          </p>
        ) : !confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Remove staff member
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-fg-muted">Are you sure?</p>
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
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-fg-muted hover:text-fg-secondary">
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
