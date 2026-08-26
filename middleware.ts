// This file runs on every request before it reaches a route.
// It refreshes the Supabase session and enforces authentication.

import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals, static files, and the
    // cron-triggered email endpoints (those authenticate via their own
    // CRON_SECRET bearer token, not a user session — letting this
    // middleware run on them would redirect the unauthenticated request to
    // /login before it ever reaches the route handler).
    '/((?!_next/static|_next/image|favicon.ico|api/send-weekly-email|api/send-monthly-email|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
