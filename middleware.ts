// This file runs on every request before it reaches a route.
// It refreshes the Supabase session and enforces authentication.

import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  console.log('[middleware] running for:', request.nextUrl.pathname)
  const res = await updateSession(request)
  console.log('[middleware] response status:', res.status, 'redirected:', res.redirected)
  return res
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
