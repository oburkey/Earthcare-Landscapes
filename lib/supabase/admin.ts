// Service-role client for admin operations (auth.admin.createUser, updateUserById, deleteUser).
// Do NOT use inside unstable_cache — see service.ts for that pattern.
// Server-only: never import this in client components.

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations.')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
