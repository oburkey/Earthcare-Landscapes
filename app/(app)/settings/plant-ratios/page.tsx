import { getCachedPlantRatioSettings, getCachedSitesList } from '@/lib/data'
import PlantRatiosSettings, { type RatioRow, type SiteOption } from './PlantRatiosSettings'

export const metadata = { title: 'Plant Ratios — Earthcare Landscapes' }

export default async function PlantRatiosPage() {
  const [rows, sites] = await Promise.all([
    getCachedPlantRatioSettings(),
    getCachedSitesList(),
  ])

  const global = (rows.find((r) => r.site_id === null) ?? null) as RatioRow | null
  const overrides = rows.filter((r) => r.site_id !== null) as RatioRow[]

  const siteOptions: SiteOption[] = sites.map((s) => ({ id: s.id, name: s.name }))

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Plant Ratios</h1>
        <p className="mt-1 text-sm text-stone-500">
          Configure plants-per-m² ratios and pot size splits used for plant quantity calculations.
        </p>
      </div>
      <PlantRatiosSettings global={global} overrides={overrides} sites={siteOptions} />
    </div>
  )
}
