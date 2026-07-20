import { requireAuth, requireRole } from '@/lib/auth'
import { getCachedVehicles } from '@/lib/data'
import { createClient } from '@/lib/supabase/server'
import { MACHINERY_CHECKLIST, TRUCK_CHECKLIST, isBadAnswer } from '@/lib/preStartChecklists'
import VehicleManagement, { type VehicleFaultEntry } from './VehicleManagement'
import type { Vehicle } from '@/types/database'

export const metadata = { title: 'Vehicles — Earthcare Landscapes' }

// Pulls pre-starts that reported an issue (a "No" on an inverted-logic-aware
// checklist item, or a general notes field) for machinery/truck vehicles, so
// mechanics can be briefed from the vehicle's own page. Most recent first.
async function fetchVehicleFaultHistory(): Promise<Record<string, VehicleFaultEntry[]>> {
  const byVehicle: Record<string, VehicleFaultEntry[]> = {}

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('pre_starts')
      .select('id, date, machine_id, truck_id, machinery_checks, truck_checks, notes, profiles(first_name, last_name)')
      .or('machine_id.not.is.null,truck_id.not.is.null')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500)

    if (error || !data) return byVehicle

    for (const r of data) {
      const submitterName = r.profiles
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? `${(r.profiles as any).first_name} ${(r.profiles as any).last_name}`.trim()
        : 'Unknown'

      // A pre-start can report against a machine and/or a truck — check each independently.
      const targets: Array<{ vehicleId: string | null; checklist: typeof MACHINERY_CHECKLIST; checks: Record<string, string> | null }> = [
        { vehicleId: r.machine_id, checklist: MACHINERY_CHECKLIST, checks: r.machinery_checks as Record<string, string> | null },
        { vehicleId: r.truck_id,   checklist: TRUCK_CHECKLIST,     checks: r.truck_checks as Record<string, string> | null },
      ]

      for (const { vehicleId, checklist, checks } of targets) {
        if (!vehicleId) continue

        const failedItems = checklist
          .filter((item) => isBadAnswer(item, checks?.[item.key]))
          .map((item) => ({ label: item.label, note: checks?.[`${item.key}_notes`] ?? null }))

        const hasGeneralNotes = !!r.notes?.trim()
        if (failedItems.length === 0 && !hasGeneralNotes) continue

        const entry: VehicleFaultEntry = {
          id: r.id,
          date: r.date,
          submitterName,
          failedItems,
          notes: hasGeneralNotes ? r.notes : null,
        }
        if (!byVehicle[vehicleId]) byVehicle[vehicleId] = []
        byVehicle[vehicleId].push(entry)
      }
    }
  } catch {
    // pre_starts table may not exist yet — show vehicles without history gracefully
  }

  return byVehicle
}

export default async function VehiclesPage() {
  const profile = await requireAuth()
  requireRole(profile, 'leading_hand')

  const [data, faultHistory] = await Promise.all([
    getCachedVehicles(),
    fetchVehicleFaultHistory(),
  ])

  const vehicles: Vehicle[] = (data ?? []) as Vehicle[]

  // Pass today from server to avoid client/server hydration mismatch on date comparisons
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <VehicleManagement vehicles={vehicles} today={today} faultHistory={faultHistory} />
      </div>
    </div>
  )
}
