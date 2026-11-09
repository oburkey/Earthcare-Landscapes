'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { LABOUR_HOURLY_RATE, BOBCAT_HOURLY_RATE } from '@/lib/pricingPresets'
import { TEMPLATE_PRESET_ITEM_NAMES } from '@/lib/extraJobPresets'
import { EXTRA_JOB_LINES_SELECT, toExtraJobLines, type ExtraJobLine } from '@/lib/extraJobLines'

// ── Quick-add presets ───────────────────────────────────────────────────────────
// Rates for the "Mulch / Edging / Turf" quick-add chips are pulled live from
// the quote template items so they stay in sync with Settings → Quote
// templates. Labour/Bobcat aren't template-driven (same as the Quotes page
// presets) so they share the constants in lib/pricingPresets.ts.

export async function getExtraJobPresetRates(): Promise<Record<string, number | null>> {
  const rates: Record<string, number | null> = {
    labour: LABOUR_HOURLY_RATE,
    bobcat: BOBCAT_HOURLY_RATE,
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('quote_template_items')
    .select('name, unit_price, quote_template_sections!inner(order_index, is_active, is_client_extra)')
    .in('name', Object.values(TEMPLATE_PRESET_ITEM_NAMES))
    .eq('is_active', true)
    .eq('quote_template_sections.is_active', true)
    .eq('quote_template_sections.is_client_extra', false)
    .order('order_index', { referencedTable: 'quote_template_sections', ascending: true })

  // Several sections can have an item with the same name (e.g. "Artificial
  // Turf" exists for both front and rear) — take the first by section order.
  const rateByName = new Map<string, number | null>()
  for (const row of data ?? []) {
    if (!rateByName.has(row.name)) {
      rateByName.set(row.name, row.unit_price != null ? Number(row.unit_price) : null)
    }
  }

  for (const [key, name] of Object.entries(TEMPLATE_PRESET_ITEM_NAMES)) {
    rates[key] = rateByName.get(name) ?? null
  }

  return rates
}

// ── Save ──────────────────────────────────────────────────────────────────────

type LinePayload = {
  id: string | null
  description: string
  qty: string
  unit: string
  rate: string
  presetKey: string | null
}

export type SaveExtraJobLinesResult = {
  error?: string
  lines?: ExtraJobLine[]
  linesUpdatedAt?: string | null
}

// Saves through save_extra_job_lines (migration_extra_job_lines_save.sql) —
// one transaction that updates existing lines in place by id, inserts new
// ones, deletes removed ones, and refuses the save if someone else saved the
// lines since this page loaded. Returns the saved lines so the table picks up
// the ids of newly inserted rows.
export async function saveExtraJobLineItems(
  _prev: unknown,
  formData: FormData
): Promise<SaveExtraJobLinesResult> {
  const profile = await requireAuth()
  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to save line items.' }
  }

  const extraJobId = formData.get('extra_job_id') as string
  const siteId      = formData.get('site_id')     as string
  const stageId     = formData.get('stage_id')    as string
  if (!extraJobId) return { error: 'Extra job ID is missing.' }
  // Passed back exactly as loaded (string, not re-parsed) so the database
  // comparison is exact to the microsecond.
  const expectedLinesUpdatedAt = (formData.get('lines_updated_at') as string) || null

  let lines: LinePayload[] = []
  try {
    lines = JSON.parse((formData.get('lines') as string) || '[]')
  } catch {
    return { error: 'Invalid line items payload.' }
  }

  const supabase = await createClient()
  const isAdmin = profile.role === 'admin'
  const presetRates = await getExtraJobPresetRates()

  const payload = []
  for (const line of lines) {
    const description = (line.description ?? '').trim()
    const qtyText     = (line.qty ?? '').trim()
    // Non-admins never see or send rates
    const rateText    = isAdmin ? (line.rate ?? '').trim() : ''
    // Only completely blank rows are dropped. Anything with a description is
    // kept, with an empty qty / price saved as null (counted as $0).
    if (!description && !qtyText && !rateText) continue

    const qty = parseFloat(qtyText)

    // keep_price: leave an existing line's price (and template link) as it
    // is — non-admins can't see prices, so their save must never change one.
    let unitPrice: number | null = null
    let keepPrice = false
    if (line.presetKey && presetRates[line.presetKey] != null) {
      // Preset-sourced lines always take the live rate, so a price changed
      // in Settings applies even to lines quick-added by a leading hand.
      unitPrice = presetRates[line.presetKey]
    } else if (isAdmin) {
      const parsed = parseFloat(rateText)
      unitPrice = isNaN(parsed) ? null : parsed
    } else {
      keepPrice = true
    }

    payload.push({
      id:          line.id,
      description: description || null,
      unit:        (line.unit ?? '').trim() || 'No.',
      quantity:    isNaN(qty) ? null : qty,
      unit_price:  unitPrice,
      keep_price:  keepPrice,
    })
  }

  const { data: linesUpdatedAt, error } = await supabase.rpc('save_extra_job_lines', {
    p_extra_job_id:              extraJobId,
    p_expected_lines_updated_at: expectedLinesUpdatedAt,
    p_lines:                     payload,
  })
  if (error) return { error: error.message }

  const { data: rows, error: reloadError } = await supabase
    .from('extra_job_quote_items')
    .select(EXTRA_JOB_LINES_SELECT)
    .eq('extra_job_id', extraJobId)
    .order('sort_order', { ascending: true })
  if (reloadError) return { error: `Saved, but reloading the lines failed: ${reloadError.message}. Reload the page.` }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/extra-jobs/${extraJobId}`)
  return {
    lines: toExtraJobLines(rows ?? [], isAdmin),
    linesUpdatedAt: (linesUpdatedAt as string | null) ?? null,
  }
}

// ── Fetch for PDF export ───────────────────────────────────────────────────────

export type ExtraJobPricingItem = {
  item_name: string
  unit: string
  quantity: number
  unit_price: number | null
  item_type: string
  sort_order: number
}

export type ExtraJobPricingData = {
  id: string
  title: string
  items: ExtraJobPricingItem[]
  total: number
}

export async function getExtraJobsPricing(jobIds: string[]): Promise<ExtraJobPricingData[]> {
  if (jobIds.length === 0) return []

  const supabase = await createClient()

  const [{ data: itemsData }, { data: jobsData }] = await Promise.all([
    supabase
      .from('extra_job_quote_items')
      .select(`
        extra_job_id, description, unit, quantity, unit_price, item_type, sort_order,
        quote_template_items(name, unit_price)
      `)
      .in('extra_job_id', jobIds)
      .order('extra_job_id')
      .order('sort_order'),
    supabase
      .from('extra_jobs')
      .select('id, title')
      .in('id', jobIds),
  ])

  const jobMap = new Map<string, string>()
  for (const j of jobsData ?? []) jobMap.set(j.id, j.title)

  const byJob = new Map<string, ExtraJobPricingItem[]>()
  for (const jobId of jobIds) byJob.set(jobId, [])

  for (const item of itemsData ?? []) {
    const arr = byJob.get(item.extra_job_id) ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tpl          = (item as any).quote_template_items
    const templateName = tpl?.name
    // Template items are saved without a unit_price snapshot; fall back to the
    // current template rate so the PDF can display totals correctly.
    const resolvedPrice = item.unit_price !== null
      ? Number(item.unit_price)
      : tpl?.unit_price != null ? Number(tpl.unit_price) : null
    arr.push({
      item_name:  templateName ?? item.description ?? '',
      unit:       item.unit,
      quantity:   Number(item.quantity ?? 0),
      unit_price: resolvedPrice,
      item_type:  item.item_type,
      sort_order: item.sort_order,
    })
    byJob.set(item.extra_job_id, arr)
  }

  return jobIds
    .filter((id) => jobMap.has(id))
    .map((id) => {
      const items = byJob.get(id) ?? []
      const total = items.reduce((sum, it) => {
        if (it.unit_price == null) return sum
        return sum + it.quantity * it.unit_price
      }, 0)
      return { id, title: jobMap.get(id) ?? '', items, total }
    })
}
