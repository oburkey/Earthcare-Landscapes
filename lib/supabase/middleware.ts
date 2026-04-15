// Supabase client for use inside Next.js proxy.
// Must use the middleware-specific pattern because proxy cannot use cookies()
// from next/headers — it works with NextRequest/NextResponse directly.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export async function updateSession(request: NextRequest) {
  // If Supabase isn't configured yet, pass the request through without
  // auth checks so the app can still render during local development.
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Refresh the session token if it has expired.
  // IMPORTANT: Do not write any logic between createServerClient and
  // getUser() — a stale token could cause redirect loops.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  console.log('[updateSession] user:', user?.id ?? 'none', '| auth error:', authError?.message ?? 'none')

  const pathname = request.nextUrl.pathname

  // Routes that don't require authentication
  const publicRoutes = ['/login', '/invite']
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  )

  if (!user && !isPublicRoute) {
    console.log('[updateSession] no user, redirecting to /login from', pathname)
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
