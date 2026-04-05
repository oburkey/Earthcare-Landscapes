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
      notes
    `)
    .order('make', { ascending: true })

  const vehicles: Vehicle[] = (data ?? []).map((v) => ({
    id:                     v.id as string,
    make:                   v.make as string,
    model:                  v.model as string,
    year:                   (v.year ?? null) as number | null,
    registration:           (v.registration ?? null) as string | null,
    assigned_to:            (v.assigned_to ?? null) as string | null,
    rego_expiry_date:       (v.rego_expiry_date ?? null) as string | null,
    insurance_expiry_date:  (v.insurance_expiry_date ?? null) as string | null,
    last_service_date:      (v.last_service_date ?? null) as string | null,
    last_service_hours:     (v.last_service_hours ?? null) as number | null,
    last_service_odometer:  (v.last_service_odometer ?? null) as number | null,
    next_service_due_date:  (v.next_service_due_date ?? null) as string | null,
    next_service_km:        (v.next_service_km ?? null) as number | null,
    next_service_hours:     (v.next_service_hours ?? null) as number | null,
    notes:                  (v.notes ?? null) as string | null,
    created_at:             '',
  }))

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
