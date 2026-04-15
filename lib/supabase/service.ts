// Service-role Supabase client — does NOT use cookies().
// Safe to use inside unstable_cache where request-scoped APIs are unavailable.
// Only use for read-only cached queries: never mutate data with this client.

import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for server-side data caching.\n' +
      'Add it to .env.local — find it in Supabase Dashboard → Project Settings → API → service_role.'
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
