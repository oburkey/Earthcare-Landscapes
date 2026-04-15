import { requireAuth, requireRole } from '@/lib/auth'
import { getCachedVehicles } from '@/lib/data'
import VehicleManagement from './VehicleManagement'
import type { Vehicle } from '@/types/database'

export const metadata = { title: 'Vehicles — Earthcare Landscapes' }

export default async function VehiclesPage() {
  const profile = await requireAuth()
  requireRole(profile, 'supervisor')

  const data = await getCachedVehicles()

  const vehicles: Vehicle[] = (data ?? []) as Vehicle[]

  // Pass today from server to avoid client/server hydration mismatch on date comparisons
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <VehicleManagement vehicles={vehicles} today={today} />
      </div>
    </div>
  )
}
