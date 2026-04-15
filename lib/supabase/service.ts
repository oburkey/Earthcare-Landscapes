// Service-role Supabase client — does NOT use cookies().
// Safe to use inside unstable_cache where request-scoped APIs are unavailable.
// Only use for read-only cached queries: never mutate data with this client.

import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  }

  if (!key) {
    // Fall back to publishable key — RLS applies, queries may return limited data.
    // Set SUPABASE_SERVICE_ROLE_KEY in .env.local for full caching behaviour.
    const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!fallbackKey) throw new Error('No Supabase key available')
    return createClient(url, fallbackKey, { auth: { persistSession: false } })
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
