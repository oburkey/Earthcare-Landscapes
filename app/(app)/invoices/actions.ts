'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { uploadToR2, getR2FileAsDataUrl } from '@/lib/r2'
import { getExtraJobsPricing } from '@/app/(app)/sites/[siteId]/stages/[stageId]/extra-jobs/[extraJobId]/pricing-actions'
import type { ActionState } from '@/types/actions'
import type { ClaimLotData, ClaimExtraJobData } from './pdfClient'
import type { LotSection } from './InvoicesView'

// Free text, not a profiles lookup — approval sometimes comes from an
// external developer's contact who isn't a user in the system, and finance
// needs to know which entity to invoice regardless.
export async function updateExtraJobApprovedBy(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can set who approved an extra job.' }

  const extraJobId = formData.get('extra_job_id') as string
  if (!extraJobId) return { error: 'Extra job ID is missing.' }

  const approvedByName = (formData.get('approved_by_name') as string)?.trim() || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('extra_jobs')
    .update({ approved_by_name: approvedByName })
    .eq('id', extraJobId)

  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function updateExtraJobFinanceNotes(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can edit finance notes.' }

  const extraJobId = formData.get('extra_job_id') as string
  if (!extraJobId) return { error: 'Extra job ID is missing.' }

  const financeNotes = (formData.get('finance_notes') as string)?.trim() || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('extra_jobs')
    .update({ finance_notes: financeNotes })
    .eq('id', extraJobId)

  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function toggleInvoiced(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can toggle Invoiced.' }

  const lotId = formData.get('lot_id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('lots')
    .update({ invoiced: value, updated_by: profile.id })
    .eq('id', lotId)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  revalidateTag('stages')
  return null
}

export async function togglePendingReview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can toggle Pending Review.' }

  const lotId = formData.get('lot_id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('lots')
    .update({ pending_review: value, updated_by: profile.id })
    .eq('id', lotId)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  revalidateTag('stages')
  return null
}

export async function toggleApprovedForInvoicing(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can toggle Approved for Invoicing.' }

  const lotId = formData.get('lot_id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  // Approving also clears pending_review
  const update: Record<string, boolean | string> = { approved_for_invoicing: value, updated_by: profile.id }
  if (value) update.pending_review = false

  const { error } = await supabase
    .from('lots')
    .update(update)
    .eq('id', lotId)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  revalidateTag('stages')
  return null
}

// ── Extra jobs — same toggle flow as lots ────────────────────────────────────

export async function toggleExtraJobComplete(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only leading hands and above can toggle Job Completed.' }
  }

  const extraJobId = formData.get('extra_job_id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('extra_jobs')
    .update({ status: value ? 'complete' : 'not_started' })
    .eq('id', extraJobId)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function toggleExtraJobPendingReview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can toggle Pending Review.' }

  const extraJobId = formData.get('extra_job_id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('extra_jobs')
    .update({ pending_review: value })
    .eq('id', extraJobId)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function toggleExtraJobApprovedForInvoicing(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can toggle Approved for Invoicing.' }

  const extraJobId = formData.get('extra_job_id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  const update: Record<string, boolean> = { approved_for_invoicing: value }
  if (value) update.pending_review = false

  const { error } = await supabase
    .from('extra_jobs')
    .update(update)
    .eq('id', extraJobId)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function toggleExtraJobInvoiced(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can toggle Invoiced.' }

  const extraJobId = formData.get('extra_job_id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('extra_jobs')
    .update({ invoiced: value })
    .eq('id', extraJobId)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function markAsInvoiced(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can create invoice runs.' }

  const lotIdsRaw          = formData.get('lot_ids')           as string
  const extraJobIdsRaw     = formData.get('extra_job_ids')      as string
  const progressClaimIdsRaw = formData.get('progress_claim_ids') as string
  const totalAmountRaw     = formData.get('total_amount')       as string
  const notes              = (formData.get('notes') as string)?.trim() || null
  const invoiceDate        = (formData.get('invoice_date') as string) || new Date().toISOString()
  const snapshotPathsRaw   = (formData.get('snapshot_paths') as string) || '{}'

  const lotIds           = lotIdsRaw           ? lotIdsRaw.split(',').filter(Boolean)           : []
  const extraJobIds      = extraJobIdsRaw      ? extraJobIdsRaw.split(',').filter(Boolean)      : []
  const progressClaimIds = progressClaimIdsRaw ? progressClaimIdsRaw.split(',').filter(Boolean) : []
  const totalAmount      = totalAmountRaw ? parseFloat(totalAmountRaw) || null : null

  let snapshotPaths: Record<string, string> = {}
  try {
    const parsed = JSON.parse(snapshotPathsRaw)
    if (parsed && typeof parsed === 'object') snapshotPaths = parsed
  } catch {
    // malformed/absent — proceed without snapshots rather than failing the invoice run
  }

  if (lotIds.length === 0 && extraJobIds.length === 0 && progressClaimIds.length === 0) {
    return { error: 'Nothing selected.' }
  }

  const supabase   = await createClient()
  const invoicedAt = invoiceDate

  const { data: runData, error: runError } = await supabase
    .from('invoice_runs')
    .insert({
      invoiced_by:        profile.id,
      invoiced_at:        invoicedAt,
      lot_ids:            lotIds,
      extra_job_ids:      extraJobIds,
      progress_claim_ids: progressClaimIds,
      total_amount:       totalAmount,
      notes,
      snapshot_paths:     snapshotPaths,
    })
    .select('id')
    .single()
  if (runError) return { error: runError.message }

  if (lotIds.length > 0) {
    const { error } = await supabase
      .from('lots')
      .update({ invoiced: true, approved_for_invoicing: false, updated_by: profile.id })
      .in('id', lotIds)
    if (error) return { error: error.message }
  }

  if (extraJobIds.length > 0) {
    const { error } = await supabase
      .from('extra_jobs')
      .update({ invoiced: true, approved_for_invoicing: false })
      .in('id', extraJobIds)
    if (error) return { error: error.message }
  }

  if (progressClaimIds.length > 0) {
    const { error } = await supabase
      .from('progress_claims')
      .update({ invoiced: true, approved_for_invoicing: false, invoice_run_id: runData.id, invoiced_at: invoicedAt })
      .in('id', progressClaimIds)
    if (error) return { error: error.message }
  }

  revalidatePath('/invoices')
  revalidateTag('stages')
  return null
}

// Reverses an invoice run: unmarks its lots/extra jobs/progress claims as
// invoiced and returns them to approved status, then deletes the run itself.
export async function deleteInvoiceRun(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can delete invoice runs.' }

  const runId = formData.get('run_id') as string
  if (!runId) return { error: 'Invoice run ID is missing.' }

  const supabase = await createClient()

  const { data: run, error: fetchError } = await supabase
    .from('invoice_runs')
    .select('lot_ids, extra_job_ids, progress_claim_ids')
    .eq('id', runId)
    .single()
  if (fetchError || !run) return { error: fetchError?.message ?? 'Invoice run not found.' }

  const lotIds = (run.lot_ids ?? []) as string[]
  const extraJobIds = (run.extra_job_ids ?? []) as string[]
  const progressClaimIds = (run.progress_claim_ids ?? []) as string[]

  if (lotIds.length > 0) {
    const { error } = await supabase
      .from('lots')
      .update({ invoiced: false, approved_for_invoicing: true, updated_by: profile.id })
      .in('id', lotIds)
    if (error) return { error: error.message }
  }

  if (extraJobIds.length > 0) {
    const { error } = await supabase
      .from('extra_jobs')
      .update({ invoiced: false, approved_for_invoicing: true })
      .in('id', extraJobIds)
    if (error) return { error: error.message }
  }

  if (progressClaimIds.length > 0) {
    const { error } = await supabase
      .from('progress_claims')
      .update({ invoiced: false, approved_for_invoicing: true, invoice_run_id: null })
      .in('id', progressClaimIds)
    if (error) return { error: error.message }
  }

  const { error: deleteError } = await supabase
    .from('invoice_runs')
    .delete()
    .eq('id', runId)
  if (deleteError) return { error: deleteError.message }

  revalidatePath('/invoices')
  revalidateTag('stages')
  return null
}

// ── Invoice snapshot PDFs ─────────────────────────────────────────────────────
// The claim sheet PDF is rendered client-side (html2pdf.js needs a browser —
// see ./pdfClient) at the moment "Mark as Invoiced" is clicked, then uploaded
// here so invoice history can show exactly what was claimed even after the
// underlying quant sheet changes later.

const SNAPSHOT_PREFIX = 'invoice-snapshots/'

// entityKey is `lot.id` for a lot snapshot, or `extrajob_{extra_job_id}` for
// an extra job snapshot — kept generic so both share one upload path/action.
export async function uploadInvoiceSnapshot(
  formData: FormData
): Promise<{ path?: string; error?: string }> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can upload invoice snapshots.' }

  const entityKey = formData.get('entity_key') as string
  const timestamp = formData.get('timestamp') as string
  const file      = formData.get('file') as File

  if (!entityKey || !timestamp) return { error: 'Missing entity key or timestamp.' }
  if (!file || file.size === 0) return { error: 'No file provided.' }
  if (file.size > 20 * 1024 * 1024) return { error: 'File too large (max 20 MB).' }
  if (file.type !== 'application/pdf') return { error: 'File must be a PDF.' }

  const safeTimestamp = timestamp.replace(/[^a-zA-Z0-9-]/g, '')
  const safeEntityKey = entityKey.replace(/[^a-zA-Z0-9_-]/g, '')
  const key = `${SNAPSHOT_PREFIX}${safeTimestamp}/${safeEntityKey}.pdf`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, 'application/pdf')
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  return { path: key }
}

// Fetches a historical claim-sheet snapshot from R2 as a data URL for the
// browser to download. Only ever reads keys under invoice-snapshots/ —
// this action must not become a generic "read any R2 object" endpoint.
export async function getInvoiceSnapshotDataUrl(
  path: string
): Promise<{ dataUrl?: string; error?: string }> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can view invoice snapshots.' }
  if (!path.startsWith(SNAPSHOT_PREFIX)) return { error: 'Invalid snapshot path.' }

  const dataUrl = await getR2FileAsDataUrl(path, 'application/pdf')
  if (!dataUrl) return { error: 'Snapshot not found in storage.' }
  return { dataUrl }
}

// ── Fallback: rebuild current pricing for a lot ──────────────────────────────
// Used by Invoice History when a run has no snapshot for a lot (invoiced
// before this feature shipped) — regenerates the claim sheet from whatever
// the lot's pricing looks like right now, which is why the caller shows a
// "not the historical version" note alongside the download.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bestQuoteScore(q: any): number {
  return q.status === 'approved' ? 3 : q.status === 'submitted' ? 2 : 1
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildClaimSections(items: any[]): { standard: number; extras: number; sections: LotSection[] } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sectionMap = new Map<string, any>()
  let standard = 0, extras = 0

  for (const item of items) {
    const qty = Number(item.quantity ?? 0)
    const price = Number(item.unit_price_snapshot ?? item.quote_template_items?.unit_price ?? 0)
    const amount = qty * price
    const isExtra: boolean = item.quote_template_items?.quote_template_sections?.is_client_extra ?? false
    const sectionId: string = item.quote_template_items?.section_id ?? '__other__'
    const sectionName: string = item.quote_template_items?.quote_template_sections?.name ?? 'Other'
    const sectionOrder: number = item.quote_template_items?.quote_template_sections?.order_index ?? 999
    const itemOrder: number = item.quote_template_items?.order_index ?? 999

    if (isExtra) extras += amount
    else standard += amount

    if (qty === 0) continue

    if (!sectionMap.has(sectionId)) {
      sectionMap.set(sectionId, { name: sectionName, isClientExtra: isExtra, orderIndex: sectionOrder, items: [] })
    }
    sectionMap.get(sectionId).items.push({
      name:      item.item_name || item.quote_template_items?.name || '',
      quantity:  qty,
      unit:      item.unit || item.quote_template_items?.unit || '',
      rate:      price,
      total:     amount,
      orderIndex: itemOrder,
    })
  }

  const sections: LotSection[] = [...sectionMap.values()]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sortedItems = [...s.items].sort((a: any, b: any) => a.orderIndex - b.orderIndex)
      return {
        id:            s.name,
        name:          s.name,
        isClientExtra: s.isClientExtra,
        orderIndex:    s.orderIndex,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: sortedItems.map((i: any) => ({
          name: i.name, quantity: i.quantity, unit: i.unit, rate: i.rate, total: i.total,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subtotal: sortedItems.reduce((sum: number, i: any) => sum + i.total, 0),
      }
    })

  return { standard, extras, sections }
}

export async function getClaimLotDataForSnapshot(
  lotId: string
): Promise<{ data?: ClaimLotData; error?: string }> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can view invoice snapshots.' }

  const supabase = await createClient()

  const { data: lot, error: lotError } = await supabase
    .from('lots')
    .select(`
      id, lot_number, contract_price, has_client_extras,
      stages!inner(id, name, default_contract_price,
        sites!inner(id, name, client_contact, has_client_extras))
    `)
    .eq('id', lotId)
    .single()
  if (lotError || !lot) return { error: lotError?.message ?? 'Lot not found.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stage = lot.stages as any
  const site = stage.sites

  const { data: quotes } = await supabase
    .from('lot_quotes')
    .select(`
      quote_type, status,
      lot_quote_items(
        quantity, unit_price_snapshot, item_name, unit,
        quote_template_items(
          unit_price, section_id, order_index,
          quote_template_sections(name, is_client_extra, order_index)
        )
      )
    `)
    .eq('lot_id', lotId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finals = ((quotes ?? []) as any[]).filter((q) => q.quote_type === 'final')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estimates = ((quotes ?? []) as any[]).filter((q) => q.quote_type === 'estimate')

  let amounts = { standard: 0, extras: 0, sections: [] as LotSection[] }
  if (finals.length > 0) {
    const best = [...finals].sort((a, b) => bestQuoteScore(b) - bestQuoteScore(a))[0]
    amounts = buildClaimSections(best.lot_quote_items ?? [])
  } else if (estimates.length > 0) {
    const best = [...estimates].sort((a, b) => bestQuoteScore(b) - bestQuoteScore(a))[0]
    amounts = buildClaimSections(best.lot_quote_items ?? [])
  }

  const showClientExtras = (site.has_client_extras ?? true) && (lot.has_client_extras ?? true)
  const effectiveContractPrice =
    lot.contract_price != null ? Number(lot.contract_price)
    : stage.default_contract_price != null ? Number(stage.default_contract_price)
    : null

  const data: ClaimLotData = {
    id:                 lot.id,
    lotNumber:          lot.lot_number,
    siteName:           site.name,
    clientContact:      site.client_contact ?? null,
    siteId:             site.id,
    stageName:          stage.name,
    stageId:            stage.id,
    standardAmount:     amounts.standard,
    clientExtrasAmount: showClientExtras ? amounts.extras : 0,
    contractPrice:      effectiveContractPrice,
    showClientExtras,
    sections:           amounts.sections,
  }

  return { data }
}

// Fetches everything needed for an extra job's claim sheet PDF — used both by
// the "Download PDF" button on the invoices page and (when no snapshot
// exists) Invoice History's fallback regeneration.
export async function getClaimExtraJobData(
  extraJobId: string
): Promise<{ data?: ClaimExtraJobData; error?: string }> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can view invoice snapshots.' }

  const supabase = await createClient()

  const { data: job, error: jobError } = await supabase
    .from('extra_jobs')
    .select(`
      id, title, description, notes, finance_notes,
      stages!inner(id, name, sites!inner(id, name))
    `)
    .eq('id', extraJobId)
    .single()
  if (jobError || !job) return { error: jobError?.message ?? 'Extra job not found.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stage = job.stages as any
  const site = stage.sites

  const [pricing] = await getExtraJobsPricing([extraJobId])

  const items = (pricing?.items ?? [])
    .filter((i) => i.unit_price != null)
    .map((i) => ({
      name:     i.item_name,
      quantity: i.quantity,
      unit:     i.unit,
      rate:     i.unit_price as number,
      total:    i.quantity * (i.unit_price as number),
    }))

  const data: ClaimExtraJobData = {
    id:           job.id,
    title:        job.title,
    siteName:     site.name,
    stageName:    stage.name,
    description:  job.description ?? null,
    notes:        job.notes ?? null,
    financeNotes: job.finance_notes ?? null,
    items,
    total: pricing?.total ?? 0,
  }

  return { data }
}
