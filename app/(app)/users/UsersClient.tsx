'use client'

import { useState } from 'react'
import { createInvite, revokeInvite } from './actions'
import type { Role } from '@/types/database'

interface Invitable {
  id: string
  name: string
  email: string
  roleLabel: string
  role: Role
}

interface NoEmail {
  id: string
  name: string
  roleLabel: string
}

interface PendingInvite {
  id: string
  email: string
  role: Role
  roleLabel: string
  token: string
  createdAt: string
  profileId: string | null
}

interface Props {
  invitable: Invitable[]
  noEmail: NoEmail[]
  pending: PendingInvite[]
}

export default function UsersClient({ invitable, noEmail, pending: initialPending }: Props) {
  const [pending, setPending] = useState(initialPending)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleInvite(profileId: string) {
    setCreatingFor(profileId)
    setError(null)
    setCreatedLink(null)

    const fd = new FormData()
    fd.set('profile_id', profileId)
    const result = await createInvite(fd)

    setCreatingFor(null)

    if (result?.error) {
      setError(result.error)
      return
    }

    if (result.success && result.token) {
      const link = `${window.location.origin}/invite?token=${result.token}`
      setCreatedLink(link)
    }
  }

  async function handleRevoke(inviteId: string) {
    setRevoking(inviteId)
    setError(null)
    const result = await revokeInvite(inviteId)
    setRevoking(null)
    if (result?.error) {
      setError(result.error)
    } else {
      setPending(prev => prev.filter(i => i.id !== inviteId))
      setCreatedLink(null)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-fg">User Management</h1>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {createdLink && (
        <div className="rounded-xl border border-green-200 bg-accent-dim p-4 space-y-2">
          <p className="text-sm font-semibold text-green-900">Invite link created</p>
          <p className="text-xs text-accent-fg">Send this link to the person. It expires once used.</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={createdLink}
              className="flex-1 rounded-lg border border-green-200 bg-surface px-3 py-1.5 text-xs text-fg font-mono"
              onFocus={e => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(createdLink)}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Pending invitations */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg-secondary uppercase tracking-wide">Pending Invitations</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-fg-muted">No pending invitations.</p>
        ) : (
          <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
            {pending.map(invite => (
              <div key={invite.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg truncate">{invite.email}</p>
                  <p className="text-xs text-fg-muted">
                    {invite.roleLabel} · Sent {new Date(invite.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const link = `${window.location.origin}/invite?token=${invite.token}`
                      setCreatedLink(link)
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
                  >
                    Show link
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(invite.id)}
                    disabled={revoking === invite.id}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {revoking === invite.id ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Staff who can be invited */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg-secondary uppercase tracking-wide">Staff Without App Access</h2>
        {invitable.length === 0 && noEmail.length === 0 ? (
          <p className="text-sm text-fg-muted">All staff members have login accounts.</p>
        ) : (
          <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
            {invitable.map(person => (
              <div key={person.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{person.name}</p>
                  <p className="text-xs text-fg-muted">{person.roleLabel} · {person.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleInvite(person.id)}
                  disabled={creatingFor === person.id}
                  className="shrink-0 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
                >
                  {creatingFor === person.id ? 'Creating…' : 'Send invite'}
                </button>
              </div>
            ))}
            {noEmail.map(person => (
              <div key={person.id} className="flex items-center justify-between px-4 py-3 gap-3 opacity-60">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{person.name}</p>
                  <p className="text-xs text-fg-muted">{person.roleLabel} · No email on file</p>
                </div>
                <span className="shrink-0 text-xs text-fg-muted">Add email first</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
