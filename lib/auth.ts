// Server-side auth helpers used in layouts and server components.

import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Role } from '@/types/database'

// Returns the current user's profile, redirects to /login if not authenticated.
export async function requireAuth(): Promise<Profile> {
  // If Supabase isn't configured, return a stub so pages can render locally
  // without a real database connection.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return {
      id: 'local-dev',
      full_name: 'Local Dev',
      role: 'admin',
      phone_number: null,
      credentials: [],
      created_at: new Date().toISOString(),
    }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      redirect('/login')
    }

    return profile as Profile
  } catch (err) {
    // redirect() throws internally — let it propagate
    if (isRedirectError(err)) throw err
    // Any other error (network, auth) → send to login rather than crash
    redirect('/login')
  }
}

// Call this at the top of a Server Component/layout to enforce a minimum role.
// Role hierarchy: worker < leading_hand < supervisor < admin  (client is separate)
const ROLE_LEVEL: Record<Role, number> = {
  client: 0,
  worker: 1,
  leading_hand: 2,
  supervisor: 3,
  admin: 4,
}

export function requireRole(profile: Profile, minimum: Role) {
  if (ROLE_LEVEL[profile.role] < ROLE_LEVEL[minimum]) {
    redirect('/dashboard')
  }
}
