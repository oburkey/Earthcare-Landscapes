import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import VehicleManagement from './VehicleManagement'
import type { Vehicle } from '@/types/database'

export const metadata = { title: 'Vehicles — Earthcare Landscapes' }

export default async function VehiclesPage() {
  const profile = await requireAuth()
  requireRole(profile, 'supervisor')

  const supabase = await createClient()
  const { data } = await supabase
    .from('vehicles')
    .select(`
      id, make, model, year, registration, assigned_to,
      rego_expiry_date, insurance_expiry_date,
      last_service_date, last_service_hours, last_service_odometer,
      next_service_due_date, next_service_km, next_service_hours,
      notes, created_at
    `)
    .order('make', { ascending: true })

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
