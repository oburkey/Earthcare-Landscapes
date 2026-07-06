'use client'

import { useState } from 'react'
import { createInvite, createEmailInvite, resendInvite, revokeInvite, deleteUserAccount } from './actions'
import type { Role } from '@/types/database'

const ROLE_LABELS: Record<Role, string> = {
  worker: 'Worker', leading_hand: 'Leading Hand',
  supervisor: 'Supervisor', admin: 'Admin', client: 'Client',
}

const INVITABLE_ROLES: Role[] = ['worker', 'leading_hand', 'supervisor', 'admin']

interface Invitable  { id: string; name: string; email: string; roleLabel: string; role: Role }
interface NoEmail    { id: string; name: string; roleLabel: string }
interface ActiveUser { id: string; name: string; email: string | null; roleLabel: string; role: Role }

interface PendingInvite {
  id: string; email: string; role: Role; roleLabel: string
  token: string; createdAt: string; sentAt: string | null; profileId: string | null
}

interface Props {
  invitable:     Invitable[]
  noEmail:       NoEmail[]
  pending:       PendingInvite[]
  activeUsers:   ActiveUser[]
  currentUserId: string
}

function expiresAt(invite: PendingInvite): Date {
  const base = new Date(invite.sentAt ?? invite.createdAt)
  base.setDate(base.getDate() + 7)
  return base
}

export default function UsersClient({
  invitable, noEmail, pending: initialPending, activeUsers: initialActive, currentUserId,
}: Props) {
  const [pending,     setPending]     = useState<PendingInvite[]>(initialPending)
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>(initialActive)

  const [actingId,    setActingId]    = useState<string | null>(null)
  const [confirmDel,  setConfirmDel]  = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState<string | null>(null)

  // Email-only invite form state
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailInput,    setEmailInput]    = useState('')
  const [roleInput,     setRoleInput]     = useState<Role>('worker')
  const [emailSending,  setEmailSending]  = useState(false)

  function notify(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(null), 5000) }
  function fail(msg: string)   { setError(msg) }

  // ── Staff-first invite ────────────────────────────────────────────────────

  async function handleInvite(profileId: string) {
    setActingId(profileId); setError(null); setSuccess(null)
    const fd = new FormData(); fd.set('profile_id', profileId)
    const result = await createInvite(fd)
    setActingId(null)
    if (result?.error) { fail(result.error); return }
    notify(`Invite sent to ${result.email}.`)
  }

  // ── Email-only invite ─────────────────────────────────────────────────────

  async function handleEmailInvite(e: React.FormEvent) {
    e.preventDefault()
    setEmailSending(true); setError(null); setSuccess(null)
    const fd = new FormData(); fd.set('email', emailInput); fd.set('role', roleInput)
    const result = await createEmailInvite(fd)
    setEmailSending(false)
    if (result?.error) { fail(result.error); return }
    notify(`Invite sent to ${result.email}.`)
    setEmailInput(''); setRoleInput('worker'); setShowEmailForm(false)
  }

  // ── Resend ────────────────────────────────────────────────────────────────

  async function handleResend(inviteId: string) {
    setActingId(inviteId); setError(null); setSuccess(null)
    const result = await resendInvite(inviteId)
    setActingId(null)
    if (result?.error) { fail(result.error); return }
    // Replace old invite with a fresh one (page will reload on next visit; for now just remove)
    setPending(prev => prev.filter(i => i.id !== inviteId))
    notify(`Invite resent to ${result.email}.`)
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  async function handleRevoke(inviteId: string) {
    setActingId(inviteId); setError(null)
    const result = await revokeInvite(inviteId)
    setActingId(null)
    if (result?.error) { fail(result.error); return }
    setPending(prev => prev.filter(i => i.id !== inviteId))
  }

  // ── Delete user ───────────────────────────────────────────────────────────

  async function handleDeleteUser(profileId: string) {
    setActingId(profileId); setError(null); setSuccess(null)
    const result = await deleteUserAccount(profileId)
    setActingId(null); setConfirmDel(null)
    if (result?.error) { fail(result.error); return }
    setActiveUsers(prev => prev.filter(u => u.id !== profileId))
    notify('User account deleted.')
  }

  const now = new Date()

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-fg">User Management</h1>

      {error   && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-lg bg-accent-dim px-3 py-2 text-sm text-accent-fg">{success}</p>}

      {/* ── Invite by email ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg-secondary uppercase tracking-wide">Invite by email</h2>
          <button
            type="button"
            onClick={() => setShowEmailForm(p => !p)}
            className="text-xs font-medium text-accent-fg hover:underline"
          >
            {showEmailForm ? 'Close' : 'New invite'}
          </button>
        </div>

        {showEmailForm && (
          <form onSubmit={handleEmailInvite} className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <p className="text-xs text-fg-muted">
              Invite someone who doesn&apos;t have a staff record yet. They&apos;ll set their own name when signing up.
            </p>
            <div className="flex gap-3">
              <input
                type="email"
                required
                placeholder="email@example.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600"
              />
              <select
                value={roleInput}
                onChange={e => setRoleInput(e.target.value as Role)}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-green-600"
              >
                {INVITABLE_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={emailSending}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {emailSending ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        )}
      </section>

      {/* ── Pending invitations ────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg-secondary uppercase tracking-wide">
          Pending Invitations ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-fg-muted">No pending invitations.</p>
        ) : (
          <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
            {pending.map(invite => {
              const exp     = expiresAt(invite)
              const expired = exp < now
              const sentDate = invite.sentAt
                ? new Date(invite.sentAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                : null
              const expDate = exp.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

              return (
                <div key={invite.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-fg truncate">{invite.email}</p>
                      {expired && (
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                          Expired
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-fg-muted">
                      {invite.roleLabel}
                      {sentDate && ` · Sent ${sentDate}`}
                      {` · ${expired ? 'Expired' : 'Expires'} ${expDate}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleResend(invite.id)}
                      disabled={actingId === invite.id}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50 transition-colors"
                    >
                      {actingId === invite.id ? 'Sending…' : 'Resend'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(invite.id)}
                      disabled={actingId === invite.id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {actingId === invite.id ? '…' : 'Revoke'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Staff without app access ───────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg-secondary uppercase tracking-wide">Staff Without App Access</h2>
        {invitable.length === 0 && noEmail.length === 0 ? (
          <p className="text-sm text-fg-muted">All staff members have login accounts or pending invitations.</p>
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
                  disabled={actingId === person.id}
                  className="shrink-0 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
                >
                  {actingId === person.id ? 'Sending…' : 'Send invite'}
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

      {/* ── Active users ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg-secondary uppercase tracking-wide">
          Active Users ({activeUsers.length})
        </h2>
        {activeUsers.length === 0 ? (
          <p className="text-sm text-fg-muted">No active user accounts.</p>
        ) : (
          <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
            {activeUsers.map(user => (
              <div key={user.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">
                      {user.name || 'Unnamed'}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs font-normal text-fg-muted">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-fg-muted">
                      {user.roleLabel}{user.email && ` · ${user.email}`}
                    </p>
                  </div>
                  {user.id !== currentUserId && (
                    confirmDel === user.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-fg-muted">Delete account?</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={actingId === user.id}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {actingId === user.id ? 'Deleting…' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDel(null)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDel(user.id)}
                        className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
