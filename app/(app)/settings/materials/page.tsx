import { getCachedMaterialsTemplate } from '@/lib/data'
import MaterialsSettings from './MaterialsSettings'

export const metadata = { title: 'Materials Template — Earthcare Landscapes' }

export default async function MaterialsSettingsPage() {
  const sectionsData = await getCachedMaterialsTemplate()

  const sections = (sectionsData ?? []).map((s) => ({
    ...s,
    admin_only: (s as { admin_only?: boolean }).admin_only ?? false,
    quote_template_items: [...(s.quote_template_items ?? [])].sort(
      (a, b) => a.order_index - b.order_index
    ),
  }))

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Materials Template</h1>
          <p className="mt-1 text-sm text-stone-500">
            Configure the quantity takeoff template. Changes apply to all new lot quotes.
          </p>
        </div>
        <MaterialsSettings sections={sections} />
      </div>
    </div>
  )
}
