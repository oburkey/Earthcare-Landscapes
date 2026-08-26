import { createClient } from '@/lib/supabase/server'
import QuoteTemplatesSettings, { type TemplateRow } from './QuoteTemplatesSettings'

export const metadata = { title: 'Quote Templates — Earthcare Landscapes' }

export default async function QuoteTemplatesSettingsPage() {
  const supabase = await createClient()

  let templates: TemplateRow[] = []
  try {
    const { data, error } = await supabase
      .from('quote_presets')
      .select('id, name, description, order_index, quote_preset_sections(name, order_index, quote_preset_items(description, qty, unit, rate, order_index))')
      .order('order_index')

    if (!error && data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      templates = (data as any[]).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? null,
        orderIndex: t.order_index,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sections: ((t.quote_preset_sections ?? []) as any[])
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((s, sIdx) => ({
            name: s.name,
            orderIndex: sIdx,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            items: ((s.quote_preset_items ?? []) as any[])
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map((i, iIdx) => ({
                description: i.description ?? '',
                qty:         Number(i.qty ?? 0),
                unit:        i.unit ?? '',
                rate:        Number(i.rate ?? 0),
                orderIndex:  iIdx,
              })),
          })),
      }))
    }
  } catch {
    templates = []
  }

  return (
    <div className="min-h-screen bg-surface-raised">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-fg">Quote Templates</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Reusable starting points for the Quotes builder — sections and line items are pre-filled when a template is picked for a new quote.
          </p>
        </div>
        <QuoteTemplatesSettings templates={templates} />
      </div>
    </div>
  )
}
