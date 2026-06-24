'use server'

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function saveQuote(
  formData: FormData
): Promise<{ error: string } | { id: string } | null> {
  const profile = await requireAuth()
  if (profile.role !== 'admin' && profile.role !== 'supervisor') {
    return { error: 'Only admins and supervisors can save quotes.' }
  }

  const id          = formData.get('id') as string | null
  const siteId      = (formData.get('site_id') as string | null) || null
  const stageId     = (formData.get('stage_id') as string | null) || null
  const reference   = ((formData.get('reference') as string) ?? '').trim()
  const description = ((formData.get('description') as string) ?? '').trim()
  const status      = formData.get('status') as string
  const rawItems    = formData.get('line_items') as string
  const notes       = ((formData.get('notes') as string) ?? '').trim()

  let lineItems: unknown
  try {
    lineItems = JSON.parse(rawItems || '[]')
  } catch {
    return { error: 'Invalid line items data.' }
  }

  const supabase = await createClient()

  if (id) {
    const { error } = await supabase
      .from('quotes')
      .update({
        site_id:     siteId,
        stage_id:    stageId,
        reference,
        description,
        status,
        line_items:  lineItems,
        notes,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/quotes')
    return null
  }

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      site_id:    siteId,
      stage_id:   stageId,
      reference,
      description,
      status,
      line_items: lineItems,
      notes,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/quotes')
  return { id: data.id }
}

export async function deleteQuote(
  formData: FormData
): Promise<{ error: string } | null> {
  const profile = await requireAuth()
  if (profile.role !== 'admin' && profile.role !== 'supervisor') {
    return { error: 'Only admins and supervisors can delete quotes.' }
  }

  const id = formData.get('id') as string
  const supabase = await createClient()
  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/quotes')
  return null
}

// ── Stages for site (used by conversion modal) ──────────────────────────────

export async function getStagesForSite(
  siteId: string
): Promise<{ id: string; name: string }[]> {
  await requireAuth()
  const supabase = await createClient()
  const { data } = await supabase
    .from('stages')
    .select('id, name')
    .eq('site_id', siteId)
    .order('order')
  return data ?? []
}

// ── Convert quote to extra job ──────────────────────────────────────────────

export async function convertQuoteToExtraJob(
  formData: FormData
): Promise<
  | { error: string }
  | { extraJobId: string; siteId: string; stageId: string; stageName: string }
> {
  const profile = await requireAuth()
  if (profile.role !== 'admin' && profile.role !== 'supervisor') {
    return { error: 'Only admins and supervisors can convert quotes.' }
  }

  const quoteId = formData.get('quote_id') as string
  const stageId = formData.get('stage_id') as string
  const siteId  = formData.get('site_id') as string

  if (!quoteId || !stageId || !siteId) {
    return { error: 'Missing required fields.' }
  }

  const supabase = await createClient()

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('description, reference, line_items')
    .eq('id', quoteId)
    .single()

  if (quoteError || !quote) return { error: 'Quote not found.' }

  const { data: stage } = await supabase
    .from('stages')
    .select('name')
    .eq('id', stageId)
    .single()

  const stageName = stage?.name ?? ''

  const title = [quote.reference, quote.description].filter(Boolean).join(' — ') || 'Converted quote'

  const { data: job, error: jobError } = await supabase
    .from('extra_jobs')
    .insert({
      stage_id:        stageId,
      title,
      description:     quote.description || null,
      source_quote_id: quoteId,
      status:          'not_started',
    })
    .select('id')
    .single()

  if (jobError || !job) return { error: jobError?.message ?? 'Failed to create extra job.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItems: any[] = Array.isArray(quote.line_items) ? quote.line_items : []
  if (lineItems.length > 0) {
    const items = lineItems.map((item, i) => ({
      extra_job_id: job.id,
      description:  item.description || '',
      unit:         item.unit || 'hr',
      quantity:     item.qty ?? 0,
      unit_price:   item.rate != null ? item.rate : null,
      item_type:    `additional_${i + 1}`,
      sort_order:   200 + i + 1,
    }))

    const { error: itemsError } = await supabase
      .from('extra_job_quote_items')
      .insert(items)

    if (itemsError) return { error: itemsError.message }
  }

  revalidatePath('/quotes')
  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidateTag('stages')

  return { extraJobId: job.id, siteId, stageId, stageName }
}
