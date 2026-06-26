'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

// ── Save ──────────────────────────────────────────────────────────────────────

export async function saveExtraJobPricing(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role === 'worker' || profile.role === 'client') {
    return { error: 'You do not have permission to save pricing.' }
  }

  const extraJobId = formData.get('extra_job_id') as string
  const siteId     = formData.get('site_id')     as string
  const stageId    = formData.get('stage_id')    as string

  if (!extraJobId) return { error: 'Extra job ID is missing.' }

  const supabase = await createClient()
  const isAdmin = profile.role === 'admin'

  // For non-admins, preserve existing rates from DB so admin-set rates are never clobbered
  const preservedRates: Record<string, number | null> = {}
  if (!isAdmin) {
    const { data: rateRows } = await supabase
      .from('extra_job_quote_items')
      .select('item_type, unit_price')
      .eq('extra_job_id', extraJobId)
      .in('item_type', ['bobcat', 'labour', 'additional_1', 'additional_2'])
    for (const r of rateRows ?? []) {
      preservedRates[r.item_type] = r.unit_price
    }
  }

  // Replace all existing items for this job
  await supabase.from('extra_job_quote_items').delete().eq('extra_job_id', extraJobId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toInsert: any[] = []

  // Template items — keys are template_<templateItemId>
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('template_')) continue
    const qty = parseFloat(value as string)
    if (!qty || isNaN(qty)) continue
    toInsert.push({
      extra_job_id:     extraJobId,
      template_item_id: key.replace('template_', ''),
      unit:             (formData.get(`unit_${key.replace('template_', '')}`) as string) || 'No.',
      quantity:         qty,
      item_type:        'template',
      sort_order:       0,
    })
  }

  // Bobcat
  const bobcatHours = parseFloat((formData.get('bobcat_hours') as string) || '')
  const bobcatRate  = isAdmin
    ? parseFloat((formData.get('bobcat_rate') as string) || '95')
    : (preservedRates['bobcat'] ?? 95)
  if (bobcatHours > 0) {
    toInsert.push({
      extra_job_id: extraJobId,
      description:  'Bobcat',
      unit:         'hr',
      quantity:     bobcatHours,
      unit_price:   isNaN(Number(bobcatRate)) ? 95 : bobcatRate,
      item_type:    'bobcat',
      sort_order:   100,
    })
  }

  // Labour
  const labourHours = parseFloat((formData.get('labour_hours') as string) || '')
  const labourRate  = isAdmin
    ? parseFloat((formData.get('labour_rate') as string) || '65')
    : (preservedRates['labour'] ?? 65)
  if (labourHours > 0) {
    toInsert.push({
      extra_job_id: extraJobId,
      description:  'Labour',
      unit:         'hr',
      quantity:     labourHours,
      unit_price:   isNaN(Number(labourRate)) ? 65 : labourRate,
      item_type:    'labour',
      sort_order:   101,
    })
  }

  // Additional free-form items
  for (let i = 1; i <= 2; i++) {
    const desc = ((formData.get(`add${i}_desc`) as string) ?? '').trim()
    const qty  = parseFloat((formData.get(`add${i}_qty`)  as string) || '')
    const unit = (formData.get(`add${i}_unit`) as string) || 'No.'
    const rate = isAdmin
      ? parseFloat((formData.get(`add${i}_rate`) as string) || '')
      : (preservedRates[`additional_${i}`] ?? NaN)
    if (desc && qty > 0) {
      toInsert.push({
        extra_job_id: extraJobId,
        description:  desc,
        unit,
        quantity:     qty,
        unit_price:   isNaN(rate) ? null : rate,
        item_type:    `additional_${i}`,
        sort_order:   200 + i,
      })
    }
  }

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
