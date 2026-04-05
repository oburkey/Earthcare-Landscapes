// Server-side Supabase client.
// Use this in Server Components, Server Actions, and Route Handlers.
// Reads/writes cookies via Next.js cookies() to keep the session alive.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export async function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase environment variables.\n' +
      'Copy .env.local.example to .env.local and fill in your project URL and publishable key.'
    )
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // setAll is called from a Server Component where cookies are
          // read-only. The proxy handles refreshing the session,
          // so this can safely be ignored.
        }
      },
    },
  })
}
