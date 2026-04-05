import { requireAuth, requireRole } from '@/lib/auth'

export const metadata = { title: 'Quotes — Earthcare Landscapes' }

export default async function QuotesPage() {
  const profile = await requireAuth()
  requireRole(profile, 'supervisor')

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Quotes</h1>
      <p className="mt-1 text-sm text-stone-500">Coming in Phase 2.</p>
    </div>
  )
}
