// Invite acceptance page.
// Workers, supervisors, and clients land here from their invite email.
// They set their name and password to complete account creation.

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AcceptInviteForm from './AcceptInviteForm'

export const metadata = { title: 'Accept Invitation — Earthcare Landscapes' }

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function InvitePage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) notFound()

  const supabase = await createClient()

  // Look up the invitation
  const { data: invitation } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .single()

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-stone-900">Invitation not found</h1>
          <p className="mt-2 text-sm text-stone-500">
            This link may have already been used or has expired.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-stone-900">Earthcare Landscapes</h1>
          <p className="mt-1 text-sm text-stone-500">
            You&apos;ve been invited as a <strong>{{
            worker: 'Worker',
            leading_hand: 'Leading Hand',
            supervisor: 'Supervisor',
            admin: 'Admin',
            client: 'Client',
          }[invitation.role as string] ?? invitation.role}</strong>. Set up your account to continue.
          </p>
        </div>
        <AcceptInviteForm token={token} email={invitation.email} />
      </div>
    </div>
  )
}
