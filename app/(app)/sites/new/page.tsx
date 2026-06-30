import Link from 'next/link'
import { requireAuth, requireRole } from '@/lib/auth'
import SiteForm from './SiteForm'

export const metadata = { title: 'Add Site — Earthcare Landscapes' }

export default async function NewSitePage() {
  const profile = await requireAuth()
  requireRole(profile, 'supervisor')

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        {/* Back */}
        <Link
          href="/sites"
          className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg-secondary"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Sites
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-fg">Add site</h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            Create a new retirement village site.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <SiteForm />
        </div>
      </div>
    </div>
  )
}
