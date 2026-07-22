import { createClient } from '@/lib/supabase/server'
import HouseTypesSettings, { type HouseTypeRow } from './HouseTypesSettings'

export const metadata = { title: 'House Types — Earthcare Landscapes' }

export default async function HouseTypesSettingsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('house_types')
    .select('id, developer, name, size, site_area, turf_area, softworks_area, alfresco_area')
    .order('developer', { ascending: true })
    .order('name', { ascending: true })

  const houseTypes: HouseTypeRow[] = (data ?? []).map((h) => ({
    id: h.id,
    developer: h.developer,
    name: h.name,
    size: h.size as HouseTypeRow['size'],
    site_area: h.site_area != null ? Number(h.site_area) : null,
    turf_area: h.turf_area != null ? Number(h.turf_area) : null,
    softworks_area: h.softworks_area != null ? Number(h.softworks_area) : null,
    alfresco_area: h.alfresco_area != null ? Number(h.alfresco_area) : null,
  }))

  return (
    <div className="min-h-screen bg-surface-raised">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-fg">House Types</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Catalogue of house designs and their standard areas, by developer.
          </p>
        </div>
        <HouseTypesSettings houseTypes={houseTypes} />
      </div>
    </div>
  )
}
