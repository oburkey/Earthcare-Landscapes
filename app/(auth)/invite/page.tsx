// Invite acceptance page — handles both invite flows:
//   staff-first (profile_id set): admin created the staff record, name is locked
//   email-only  (profile_id null): admin invited by email, user sets their own name

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import AcceptInviteForm from './AcceptInviteForm'

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

  const supabase = createAdminClient()

  const { data: invitation } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .single()

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

  // For staff-first invites, fetch the name already set by the admin
  let existingFirstName: string | null = null
  let existingLastName:  string | null = null

  if (invitation.profile_id) {
    const { data: p } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', invitation.profile_id)
      .single()
    existingFirstName = p?.first_name ?? null
    existingLastName  = p?.last_name  ?? null
  }

  const roleLabel   = ROLE_LABELS[invitation.role as string] ?? invitation.role
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
