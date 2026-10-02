'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'
import { LABOUR_HOURLY_RATE, BOBCAT_HOURLY_RATE } from '@/lib/pricingPresets'

// ── Quick-add presets ───────────────────────────────────────────────────────────
// Rates for the "Mulch / Edging / Turf" quick-add chips are pulled live from
// the quote template items so they stay in sync with Settings → Quote
// templates. Labour/Bobcat aren't template-driven (same as the Quotes page
// presets) so they share the constants in lib/pricingPresets.ts.

const TEMPLATE_PRESET_ITEM_NAMES: Record<string, string> = {
  mulch_limestone:      'Mulch Limestone 32mm',
  mulch_black:          'Black Mulch',
  mulch_laterite:       'Laterite compacted gravel',
  mulch_recycled_brick: 'Recycled Brick',
  edging:               'Steel Edging',
  turf:                 'Artificial Turf',
}

// `itemName` is the exact quote_template_items.name — it's what gets saved
// as the line's description (not the shorter `label`), so quick-added mulch
// lines still match the materials planning page's name-based lookups
// (see app/(app)/materials/lib.ts FRONT_BED_ITEMS / REAR_BED_ITEMS).
export const MULCH_PRESET_OPTIONS = [
  { key: 'mulch_limestone',      label: 'Limestone 32mm', itemName: TEMPLATE_PRESET_ITEM_NAMES.mulch_limestone },
  { key: 'mulch_black',          label: 'Black Mulch',    itemName: TEMPLATE_PRESET_ITEM_NAMES.mulch_black },
  { key: 'mulch_laterite',       label: 'Laterite',       itemName: TEMPLATE_PRESET_ITEM_NAMES.mulch_laterite },
  { key: 'mulch_recycled_brick', label: 'Recycled Brick', itemName: TEMPLATE_PRESET_ITEM_NAMES.mulch_recycled_brick },
] as const

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

export async function saveExtraJobLineItems(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role === 'worker' || profile.role === 'client') {
    return { error: 'You do not have permission to save line items.' }
  }

  const extraJobId = formData.get('extra_job_id') as string
  const siteId      = formData.get('site_id')     as string
  const stageId     = formData.get('stage_id')    as string
  if (!extraJobId) return { error: 'Extra job ID is missing.' }

  let lines: LinePayload[] = []
  try {
    lines = JSON.parse((formData.get('lines') as string) || '[]')
  } catch {
    return { error: 'Invalid line items payload.' }
  }

  const supabase = await createClient()
  const isAdmin = profile.role === 'admin'

  // Non-admins never receive unit_price values from the server, so when they
  // save we must look up each existing line's rate by id and carry it
  // forward — otherwise their save would silently wipe out admin-set prices.
  const existingRateById = new Map<string, number | null>()
  if (!isAdmin) {
    const { data: rows } = await supabase
      .from('extra_job_quote_items')
      .select('id, unit_price')
      .eq('extra_job_id', extraJobId)
    for (const r of rows ?? []) existingRateById.set(r.id, r.unit_price)
  }

  const presetRates = await getExtraJobPresetRates()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toInsert: any[] = []
  let sortOrder = 0
  for (const line of lines) {
    const description = (line.description ?? '').trim()
    const qty = parseFloat(line.qty)
    if (!description || !(qty > 0)) continue
    const unit = (line.unit ?? '').trim() || 'No.'

    let rate: number | null
    if (line.presetKey && presetRates[line.presetKey] != null) {
      // Always resolve preset-sourced lines from the live rate, so changing
      // a price in Settings is reflected even if this line was quick-added
      // by a leading hand who never saw the number.
      rate = presetRates[line.presetKey]
    } else if (isAdmin) {
      const parsed = parseFloat(line.rate)
      rate = isNaN(parsed) ? null : parsed
    } else {
      rate = line.id ? (existingRateById.get(line.id) ?? null) : null
    }

    toInsert.push({
      extra_job_id: extraJobId,
      description,
      unit,
      quantity:   qty,
      unit_price: rate,
      item_type:  'line',
      sort_order: sortOrder++,
    })
  }

  // Replace all existing items for this job
  await supabase.from('extra_job_quote_items').delete().eq('extra_job_id', extraJobId)

  if (toInsert.length > 0) {
    const { error } = await supabase.from('extra_job_quote_items').insert(toInsert)
    if (error) return { error: error.message }
  }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/extra-jobs/${extraJobId}`)
  return null
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
