import { requireAuth, requireRole } from '@/lib/auth'

export const metadata = { title: 'Invoices — Earthcare Landscapes' }

export default async function InvoicesPage() {
  const profile = await requireAuth()
  requireRole(profile, 'admin')

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Invoices</h1>
      <p className="mt-1 text-sm text-stone-500">Coming in Phase 3.</p>
    </div>
  )
}
