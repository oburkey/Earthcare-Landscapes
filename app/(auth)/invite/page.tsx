// Invite acceptance page — handles both invite flows:
//   staff-first (profile_id set): admin created the staff record, name is locked
//   email-only  (profile_id null): admin invited by email, user sets their own name

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AcceptInviteForm from './AcceptInviteForm'

// Row shape returned by get_invitation_by_token()
// (supabase/migration_rls_invites_profiles.sql)
type InvitationLookup = {
  email:      string
  role:       string
  profile_id: string | null
  sent_at:    string | null
  created_at: string
  first_name: string | null
  last_name:  string | null
}

export const metadata = { title: 'Accept Invitation — Earthcare Landscapes' }

const ROLE_LABELS: Record<string, string> = {
  worker: 'Worker', leading_hand: 'Leading Hand',
  supervisor: 'Supervisor', admin: 'Admin', client: 'Client',
}

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function InvitePage({ searchParams }: Props) {
  const { token } = await searchParams
  if (!token) notFound()

  // Anonymous visitors can't read invitations directly (RLS) — the
  // get_invitation_by_token() security definer function returns just this one
  // pending invite, plus the staff member's name for staff-first invites.
  const supabase = await createClient()

  const { data: rows } = await supabase.rpc('get_invitation_by_token', { p_token: token })
  const invitation = (rows as InvitationLookup[] | null)?.[0] ?? null

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-stone-900">Invitation not found</h1>
          <p className="text-sm text-stone-500">This link may have already been used or has expired.</p>
        </div>
      </div>
    )
  }

  // 7-day expiry from sent_at (or created_at for older invitations)
  const base      = new Date(invitation.sent_at ?? invitation.created_at)
  const expiresAt = new Date(base)
  expiresAt.setDate(expiresAt.getDate() + 7)

  if (expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-stone-900">Invitation expired</h1>
          <p className="text-sm text-stone-500">
            This link expired on{' '}
            {expiresAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
          <p className="text-sm text-stone-500">Ask an admin to send you a new invitation.</p>
        </div>
      </div>
    )
  }

  // For staff-first invites, the name already set by the admin
  const existingFirstName = invitation.profile_id ? invitation.first_name : null
  const existingLastName  = invitation.profile_id ? invitation.last_name  : null

  const roleLabel   = ROLE_LABELS[invitation.role] ?? invitation.role
  const displayName = existingFirstName ? `${existingFirstName}${existingLastName ? ` ${existingLastName}` : ''}` : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-stone-900">Earthcare Landscapes</h1>
          <p className="mt-1 text-sm text-stone-500">
            {displayName
              ? <>Hi <strong>{displayName}</strong> — you&apos;ve been invited as a <strong>{roleLabel}</strong>. Set your password to continue.</>
              : <>You&apos;ve been invited as a <strong>{roleLabel}</strong>. Set up your account to continue.</>
            }
          </p>
        </div>
        <AcceptInviteForm
          token={token}
          email={invitation.email}
          profileId={invitation.profile_id as string | null}
          existingFirstName={existingFirstName}
          existingLastName={existingLastName}
        />
      </div>
    </div>
  )
}
