import { createClient } from '@/lib/supabase/server'
import MaterialsSettings from './MaterialsSettings'

export const metadata = { title: 'Materials Template — Earthcare Landscapes' }

export default async function MaterialsSettingsPage() {
  const supabase = await createClient()

  const { data: sectionsData } = await supabase
    .from('quote_template_sections')
    .select(`
      id, name, order_index, is_active,
      quote_template_items (
        id, name, unit, unit_price, is_auto_calculated, auto_calc_formula,
        plant_category, order_index, is_active
      )
    `)
    .order('order_index', { ascending: true })

  const sections = (sectionsData ?? []).map((s) => ({
    ...s,
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
