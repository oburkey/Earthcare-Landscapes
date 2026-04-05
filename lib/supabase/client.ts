// Browser-side Supabase client.
// Use this in Client Components ('use client') only.
// Creates a single instance per page load.

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase environment variables.\n' +
      'Copy .env.local.example to .env.local and fill in your project URL and publishable key.'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}
