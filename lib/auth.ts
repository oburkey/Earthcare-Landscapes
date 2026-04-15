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
    console.log('[requireAuth] creating supabase client')
    const supabase = await createClient()
    console.log('[requireAuth] calling getUser')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('[requireAuth] user:', user?.id ?? 'none', '| error:', userError?.message ?? 'none')

    if (!user) {
      console.log('[requireAuth] no user — redirecting to /login')
      redirect('/login')
    }

    console.log('[requireAuth] fetching profile for', user.id)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    console.log('[requireAuth] profile:', profile?.id ?? 'none', '| error:', profileError?.message ?? 'none')

    if (!profile) {
      console.log('[requireAuth] no profile — redirecting to /login')
      redirect('/login')
    }

    console.log('[requireAuth] success, role:', profile.role)
    return profile as Profile
  } catch (err) {
    // redirect() throws internally — let it propagate
    if (isRedirectError(err)) throw err
    // Any other error (network, auth) → send to login rather than crash
    console.error('[requireAuth] unexpected error:', err)
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
