import { requireAuth, requireRole } from '@/lib/auth'
import { getCachedMaterialsPlanningData, getCachedPlantRatioSettings } from '@/lib/data'
import { getR2SignedUrlSafe } from '@/lib/r2'
import { buildMaterialsPlan, getMaterialsDateRange, type MaterialsLotRow, type MaterialsExtraJobRow, type RatioSettingRow } from './lib'
import MaterialsView from './MaterialsView'

export const metadata = { title: 'Materials — Earthcare Landscapes' }

export default async function MaterialsPage() {
  const profile = await requireAuth()
  requireRole(profile, 'admin')

  const { startDate, endDate, months } = getMaterialsDateRange()

  const [data, ratioSettings] = await Promise.all([
    getCachedMaterialsPlanningData(startDate, endDate),
    getCachedPlantRatioSettings(),
  ])

  const plan = buildMaterialsPlan(
    data as { lots: MaterialsLotRow[]; jobs: MaterialsExtraJobRow[] },
    ratioSettings as RatioSettingRow[],
    months
  )

  // Resolve signed URLs for each lot's uploaded site plan PDF (if any).
  const lotSitePlanUrls: Record<string, string> = {}
  for (const month of plan) {
    for (const site of month.sites) {
      for (const lot of site.lots) {
        if (lot.sitePlanPath) {
          lotSitePlanUrls[lot.id] = await getR2SignedUrlSafe(lot.sitePlanPath)
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Materials</h1>
        <p className="mt-1 text-sm text-stone-500">
          Plant ordering summary for the next 3 months, based on estimate quant sheets.
        </p>
      </div>
      <MaterialsView months={plan} lotSitePlanUrls={lotSitePlanUrls} />
    </div>
  )
}
