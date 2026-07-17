import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import InvoicesView from './InvoicesView'
import ApprovedPanel from './ApprovedPanel'
import InvoiceHistory from './InvoiceHistory'
import type { SiteData, StageData, LotRow, LotSection, ExtraJobRow } from './InvoicesView'
import type { ApprovedLot, ApprovedExtraJob, ApprovedProgressClaim } from './ApprovedPanel'
import type { InvoiceRun } from './InvoiceHistory'
import type { ProgressClaimRow } from './ProgressClaimsSection'
import { getExtraJobsPricing } from '@/app/(app)/sites/[siteId]/stages/[stageId]/extra-jobs/[extraJobId]/pricing-actions'

export const metadata = { title: 'Invoices — Earthcare Landscapes' }

export default async function InvoicesPage() {
  const profile = await requireAuth()
  requireRole(profile, 'admin')

  const supabase = await createClient()

  // ── Query 1: Sites → stages → lots ───────────────────────────────────────
  // Try with new columns; fall back if SQL migration hasn't run yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let activeSites: any[] = []
  {
    const { data, error } = await supabase
      .from('sites')
      .select(`
        id, name, client_contact, completed_at, has_client_extras,
        stages(id, name, order, completed_at, is_contract_pricing,
          lots(id, lot_number, build_complete, quant_done, invoiced, pending_review, approved_for_invoicing, has_client_extras, contract_price),
          extra_jobs(id, title, status)
        )
      `)
      .order('name')

    if (!error && data) {
      activeSites = data.filter((s) => !s.completed_at)
    } else {
      // Fallback: query without new columns
      const fallback = await supabase
        .from('sites')
        .select(`
          id, name, client_contact, completed_at, has_client_extras,
          stages(id, name, order, is_contract_pricing,
            lots(id, lot_number, build_complete, quant_done, invoiced, has_client_extras, contract_price),
            extra_jobs(id, title, status)
          )
        `)
        .order('name')
      activeSites = (fallback.data ?? []).filter((s) => !s.completed_at)
    }
  }

  // Collect all lot IDs (across all active, non-completed stages)
  const allLotIds: string[] = []
  for (const site of activeSites) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const stage of (site.stages ?? []) as any[]) {
      if (stage.completed_at) continue  // skip completed stages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const lot of (stage.lots ?? []) as any[]) {
        allLotIds.push(lot.id)
      }
    }
  }

  // Collect all extra job IDs
  const allExtraJobIds: string[] = []
  for (const site of activeSites) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const stage of (site.stages ?? []) as any[]) {
      if (stage.completed_at) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const job of (stage.extra_jobs ?? []) as any[]) {
        allExtraJobIds.push(job.id)
      }
    }
  }

  // Extra job pricing
  const extraJobPricingData = allExtraJobIds.length > 0
    ? await getExtraJobsPricing(allExtraJobIds)
    : []
  const extraJobTotalById = new Map(extraJobPricingData.map((d) => [d.id, d.total]))

  // ── Query 2: Quotes — separate estimate vs final per lot ──────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function bestQuoteScore(q: any): number {
    const statusScore = q.status === 'approved' ? 3 : q.status === 'submitted' ? 2 : 1
    return statusScore
  }

  type AmountData = { standard: number; extras: number; sections: LotSection[] }
  const amountByLot   = new Map<string, AmountData>()
  const estimateByLot = new Map<string, number>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildSections(items: any[]): AmountData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sectionMap = new Map<string, any>()
    let standard = 0, extras = 0

    for (const item of items) {
      const qty = Number(item.quantity ?? 0)
      const price = Number(
        item.unit_price_snapshot
        ?? item.quote_template_items?.unit_price
        ?? 0
      )
      const amount = qty * price
      const isExtra: boolean =
        item.quote_template_items?.quote_template_sections?.is_client_extra ?? false
      const sectionId: string =
        item.quote_template_items?.section_id ?? '__other__'
      const sectionName: string =
        item.quote_template_items?.quote_template_sections?.name ?? 'Other'
      const sectionOrder: number =
        item.quote_template_items?.quote_template_sections?.order_index ?? 999
      const itemOrder: number =
        item.quote_template_items?.order_index ?? 999

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subtotal = sortedItems.reduce((sum: number, i: any) => sum + i.total, 0)
        return {
          id:            s.name,
          name:          s.name,
          isClientExtra: s.isClientExtra,
          orderIndex:    s.orderIndex,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: sortedItems.map((i: any) => ({
            name:     i.name,
            quantity: i.quantity,
            unit:     i.unit,
            rate:     i.rate,
            total:    i.total,
          })),
          subtotal,
        }
      })

    return { standard, extras, sections }
  }

  if (allLotIds.length > 0) {
    const quotesResult = await supabase
      .from('lot_quotes')
      .select(`
        lot_id, is_estimated, status,
        lot_quote_items(
          quantity, unit_price_snapshot, item_name, unit,
          quote_template_items(
            unit_price, section_id, order_index,
            quote_template_sections(name, is_client_extra, order_index)
          )
        )
      `)
      .in('lot_id', allLotIds)

    if (quotesResult.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byLot = new Map<string, { finals: any[]; estimates: any[] }>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const q of quotesResult.data as any[]) {
        if (!byLot.has(q.lot_id)) byLot.set(q.lot_id, { finals: [], estimates: [] })
        if (q.is_estimated) byLot.get(q.lot_id)!.estimates.push(q)
        else byLot.get(q.lot_id)!.finals.push(q)
      }

      for (const [lotId, { finals, estimates }] of byLot) {
        let estimateData: AmountData | null = null

        if (estimates.length > 0) {
          const best = [...estimates].sort((a, b) => bestQuoteScore(b) - bestQuoteScore(a))[0]
          estimateData = buildSections(best.lot_quote_items ?? [])
          estimateByLot.set(lotId, estimateData.standard + estimateData.extras)
        }

        if (finals.length > 0) {
          const best = [...finals].sort((a, b) => bestQuoteScore(b) - bestQuoteScore(a))[0]
          amountByLot.set(lotId, buildSections(best.lot_quote_items ?? []))
        } else if (estimateData) {
          // No final quote yet — use estimate sections as fallback for PDF
          amountByLot.set(lotId, estimateData)
        }
      }
    }
  }

  // ── Invoice runs (graceful fallback if table doesn't exist) ───────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let invoiceRunsRaw: any[] = []
  try {
    const { data, error } = await supabase
      .from('invoice_runs')
      .select('id, invoiced_at, invoiced_by, total_amount, notes, lot_ids, extra_job_ids, profiles(first_name, last_name)')
      .order('invoiced_at', { ascending: false })
      .limit(50)
    if (!error) invoiceRunsRaw = data ?? []
  } catch {
    // table doesn't exist yet — skip gracefully
  }

  const invoicedExtraJobIds = new Set<string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoiceRunsRaw.flatMap((r: any) => r.extra_job_ids ?? [])
  )

  // ── Query 4: Progress claims (graceful fallback) ───────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const progressClaimsByStage = new Map<string, any[]>()
  try {
    const stageIds = activeSites.flatMap((s) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s.stages ?? []).filter((st: any) => !st.completed_at && st.is_contract_pricing).map((st: any) => st.id)
    )
    if (stageIds.length > 0) {
      const { data, error } = await supabase
        .from('progress_claims')
        .select('id, stage_id, claim_number, percentage, claim_amount, notes, pending_review, approved_for_invoicing, invoiced')
        .in('stage_id', stageIds)
        .order('claim_number', { ascending: true })
      if (!error && data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const claim of data as any[]) {
          const list = progressClaimsByStage.get(claim.stage_id) ?? []
          list.push(claim)
          progressClaimsByStage.set(claim.stage_id, list)
        }
      }
    }
  } catch {
    // table doesn't exist yet — skip gracefully
  }

  // ── Build view data ───────────────────────────────────────────────────────
  const approvedLots: ApprovedLot[]              = []
  const approvedExtraJobs: ApprovedExtraJob[]    = []
  const approvedProgressClaims: ApprovedProgressClaim[] = []

  const sites: SiteData[] = activeSites
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((site: any): SiteData => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stages: StageData[] = ([...(site.stages ?? [])] as any[])
        .filter((stage) => !stage.completed_at)  // exclude completed stages
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((stage): StageData => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const siteShowClientExtras = (site as any).has_client_extras ?? true
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lots: LotRow[] = ((stage.lots ?? []) as any[])
            .map((lot): LotRow => {
              const amounts          = amountByLot.get(lot.id) ?? { standard: 0, extras: 0, sections: [] }
              const showClientExtras = siteShowClientExtras && (lot.has_client_extras ?? true)

              // Collect approved lots for the panel
              if (lot.approved_for_invoicing) {
                approvedLots.push({
                  id:                  lot.id,
                  lotNumber:           lot.lot_number,
                  siteName:            site.name,
                  clientContact:       site.client_contact ?? null,
                  siteId:              site.id,
                  stageName:           stage.name,
                  stageId:             stage.id,
                  standardAmount:      amounts.standard,
                  clientExtrasAmount:  showClientExtras ? amounts.extras : 0,
                  contractPrice:       lot.contract_price != null ? Number(lot.contract_price) : null,
                  showClientExtras,
                  sections:            amounts.sections,
                })
              }

              return {
                id:                   lot.id,
                lotNumber:            lot.lot_number,
                buildComplete:        lot.build_complete        ?? false,
                quantDone:            lot.quant_done            ?? false,
                invoiced:             lot.invoiced              ?? false,
                pendingReview:        lot.pending_review        ?? false,
                approvedForInvoicing: lot.approved_for_invoicing ?? false,
                standardAmount:       amounts.standard,
                clientExtrasAmount:   showClientExtras ? amounts.extras : 0,
                estimateTotal:        estimateByLot.get(lot.id) ?? null,
                sections:             amounts.sections,
                showClientExtras,
                contractPrice:        lot.contract_price != null ? Number(lot.contract_price) : null,
              }
            })
            .sort((a, b) =>
              a.lotNumber.localeCompare(b.lotNumber, undefined, { numeric: true })
            )

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const extraJobs: ExtraJobRow[] = ((stage.extra_jobs ?? []) as any[]).map((j): ExtraJobRow => {
            const total = extraJobTotalById.get(j.id) ?? 0
            // Collect non-invoiced extra jobs with pricing for the panel
            if (!invoicedExtraJobIds.has(j.id) && total > 0) {
              approvedExtraJobs.push({
                id:       j.id,
                title:    j.title,
                siteName: site.name,
                siteId:   site.id,
                stageId:  stage.id,
                amount:   total,
              })
            }
            return { id: j.id, title: j.title, status: j.status, total }
          })

          const isContractPricing = stage.is_contract_pricing ?? false
          const totalContractValue = lots.reduce((s, l) => s + (l.contractPrice ?? 0), 0)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawClaims: any[] = progressClaimsByStage.get(stage.id) ?? []
          const progressClaims: ProgressClaimRow[] = rawClaims.map((c) => ({
            id:                   c.id,
            claimNumber:          c.claim_number,
            percentage:           c.percentage != null ? Number(c.percentage) : null,
            claimAmount:          Number(c.claim_amount),
            notes:                c.notes,
            pendingReview:        c.pending_review ?? false,
            approvedForInvoicing: c.approved_for_invoicing ?? false,
            invoiced:             c.invoiced ?? false,
          }))

          // Collect approved-for-invoicing (not yet invoiced) progress claims for the panel
          for (const c of progressClaims) {
            if (c.approvedForInvoicing && !c.invoiced) {
              approvedProgressClaims.push({
                id:          c.id,
                claimNumber: c.claimNumber,
                stageName:   stage.name,
                siteName:    site.name,
                amount:      c.claimAmount,
                percentage:  c.percentage,
              })
            }
          }

          return { id: stage.id, name: stage.name, lots, extraJobs, isContractPricing, progressClaims, totalContractValue }
        })
        .filter((st) => st.lots.length > 0 || st.extraJobs.length > 0)
      return { id: site.id, name: site.name, clientContact: site.client_contact ?? null, stages }
    })
    .filter((s) => s.stages.length > 0)

  // ── Invoice history ───────────────────────────────────────────────────────
  // Build lookup maps for resolving IDs in history
  const lotById = new Map<string, { lotNumber: string; siteName: string; stageName: string }>()
  const extraJobById = new Map<string, { title: string; siteName: string }>()
  const progressClaimById = new Map<string, { claimNumber: number; stageName: string; siteName: string; amount: number }>()
  for (const site of activeSites) {
    for (const stage of (site.stages ?? [])) {
      for (const lot of (stage.lots ?? [])) {
        lotById.set(lot.id, { lotNumber: lot.lot_number, siteName: site.name, stageName: stage.name })
      }
      for (const job of (stage.extra_jobs ?? [])) {
        extraJobById.set(job.id, { title: job.title, siteName: site.name })
      }
    }
  }
  for (const [stageId, claims] of progressClaimsByStage) {
    for (const site of activeSites) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stage = (site.stages ?? []).find((st: any) => st.id === stageId)
      if (stage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const c of claims as any[]) {
          progressClaimById.set(c.id, {
            claimNumber: c.claim_number,
            stageName:   stage.name,
            siteName:    site.name,
            amount:      Number(c.claim_amount),
          })
        }
        break
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceHistory: InvoiceRun[] = invoiceRunsRaw.map((r: any): InvoiceRun => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileData = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles as any
    const lotIds: string[]           = r.lot_ids            ?? []
    const extraJobIds: string[]      = r.extra_job_ids      ?? []
    const progressClaimIds: string[] = r.progress_claim_ids ?? []
    return {
      id:               r.id,
      invoicedAt:       r.invoiced_at,
      invoicedByName:   profileData
        ? `${profileData.first_name ?? ''} ${profileData.last_name ?? ''}`.trim() || null
        : null,
      totalAmount:         r.total_amount,
      notes:               r.notes,
      lotCount:            lotIds.length,
      extraJobCount:       extraJobIds.length,
      progressClaimCount:  progressClaimIds.length,
      lotDetails:          lotIds.map((id) => lotById.get(id) ?? { lotNumber: id.slice(0, 8), siteName: '—', stageName: '—' }),
      extraJobDetails:     extraJobIds.map((id) => extraJobById.get(id) ?? { title: id.slice(0, 8), siteName: '—' }),
      progressClaimDetails: progressClaimIds.map((id) => progressClaimById.get(id) ?? { claimNumber: 0, stageName: '—', siteName: '—', amount: 0 }),
    }
  })

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
        <h1 className="text-xl font-semibold text-fg">Invoices</h1>
        <ApprovedPanel lots={approvedLots} extraJobs={approvedExtraJobs} progressClaims={approvedProgressClaims} />
        <InvoicesView sites={sites} isAdmin={true} />
        <InvoiceHistory runs={invoiceHistory} />
      </div>
    </div>
  )
}
