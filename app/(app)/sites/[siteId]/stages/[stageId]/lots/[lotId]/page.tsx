import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { STATUS_CONFIG, formatDate, PHOTO_TYPE_LABELS, DOC_TYPE_LABELS, PHOTO_CATEGORY_LABELS, PHOTO_CATEGORY_BADGE_CLASS } from '@/lib/lotStatus'
import type { LotStatus } from '@/types/database'
import { uploadLotPhoto, setLotDelayed, clearLotDelayed } from './actions'
import EditLotForm from './EditLotForm'
import HomeDesignField from './HomeDesignField'
import PhotoUpload from '@/app/_components/PhotoUpload'
import LotDocumentUpload from './LotDocumentUpload'
import LotDocumentRow from './LotDocumentRow'
import LotDocumentPreview from './LotDocumentPreview'
import LotQuantities from './LotQuantities'
import LotStatusToggles from './LotStatusToggles'
import DelayControl from '@/app/_components/DelayControl'
import SubcontractorCosts from './SubcontractorCosts'
import type { SubcontractorCostRow } from './SubcontractorCosts'
import TradeStatusSection from './TradeStatusSection'
import ChecklistSection from './ChecklistSection'
import { getR2SignedUrlSafe } from '@/lib/r2'
import { getCachedPlantRatioSettings, getCachedLotBudgetVsEstimate } from '@/lib/data'
import { fmtCurrency } from '@/app/(app)/analytics/format'

interface Props {
  params: Promise<{ siteId: string; stageId: string; lotId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { lotId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('lots')
    .select('lot_number')
    .eq('id', lotId)
    .single()
  return { title: data ? `Lot ${data.lot_number} — Earthcare Landscapes` : 'Lot' }
}

async function uploadLotPhotoAction(formData: FormData) {
  'use server'
  return uploadLotPhoto(null, formData)
}

// Same Australia/Perth-anchored approach as LotQuantities.tsx's
// formatPerthDateTime, date-only (no time-of-day needed for photo captions).
function formatPerthDate(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Perth', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(iso))
}

export default async function LotPage({ params }: Props) {
  const { siteId, stageId, lotId } = await params
  const profile = await requireAuth()
  const canManage    = profile.role === 'leading_hand' || profile.role === 'supervisor' || profile.role === 'admin'
  const canSupervise = profile.role === 'supervisor' || profile.role === 'admin'
  const isAdmin      = profile.role === 'admin'
  const showQty      = profile.role !== 'worker' && profile.role !== 'client'

  const supabase = await createClient()

  const [
    lotResult,
    { data: photoRows },
    { data: docRows },
    { data: sectionsData },
    { data: quotesData },
    tradeStatusResult,
    checklistResult,
    subcontractorCostsResult,
  ] = await Promise.all([
    supabase
      .from('lots')
      .select(`
        id, lot_number, status, due_date, scheduled_date, completion_date, notes, home_design,
        build_complete, invoiced, has_client_extras, extras_notes, contract_price, is_corner,
        pending_review, approved_for_invoicing, delayed, delay_reason, expected_completion_date,
        stages!inner(id, name, is_contract_pricing, default_contract_price, sites!inner(id, name, has_client_extras))
      `)
      .eq('id', lotId)
      .single(),
    supabase
      .from('lot_photos')
      .select('id, storage_path, photo_type, notes, photo_category, created_at, profiles!uploaded_by(first_name, last_name)')
      .eq('lot_id', lotId)
      .order('created_at', { ascending: true }),
    supabase
      .from('lot_documents')
      .select('id, document_name, document_type, storage_path, created_at')
      .eq('lot_id', lotId)
      .order('created_at', { ascending: true }),
    // Template: only active sections + items
    showQty
      ? supabase
          .from('quote_template_sections')
          .select(`
            id, name, order_index, admin_only, is_client_extra,
            quote_template_items (
              id, name, unit, unit_price,
              is_auto_calculated, auto_calc_formula, plant_category, order_index, is_active
            )
          `)
          .eq('is_active', true)
          .order('order_index', { ascending: true })
      : Promise.resolve({ data: null }),
    // Existing quotes for this lot (estimate/budget/final — RLS hides the
    // estimate row entirely for non-admin sessions, so quotesData naturally
    // excludes it for them)
    showQty
      ? supabase
          .from('lot_quotes')
          .select(`
            id, quote_type, status, notes, last_edited_at,
            profiles!last_edited_by (first_name, last_name),
            lot_quote_items (template_item_id, quantity, unit_price_snapshot)
          `)
          .eq('lot_id', lotId)
      : Promise.resolve({ data: null }),
    // Trade status — table may not exist yet, handled gracefully below
    supabase
      .from('lot_trade_status')
      .select('trades_completed, ready_for_landscaping, blocking_notes, updated_at, profiles(first_name, last_name)')
      .eq('lot_id', lotId)
      .maybeSingle(),
    // Completion checklist — table may not exist yet, handled gracefully below
    supabase
      .from('lot_checklist_items')
      .select('item_key, completed, response, completed_date')
      .eq('lot_id', lotId),
    // Subcontractor costs — table may not exist yet
    supabase
      .from('subcontractor_costs')
      .select('id, trade, trade_label, invoice_amount, invoice_date, notes')
      .eq('lot_id', lotId)
      .order('created_at', { ascending: true }),
  ])

  // Fall back to query without flag columns if they don't exist yet
  let lot = lotResult.data
  if (!lot && lotResult.error) {
    const { data } = await supabase
      .from('lots')
      .select(`
        id, lot_number, status, due_date, scheduled_date, completion_date, notes,
        stages!inner(id, name, sites!inner(id, name))
      `)
      .eq('id', lotId)
      .single()
    lot = data as typeof lotResult.data
  }

  if (!lot) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lotAny          = lot as any
  const buildComplete          = lotAny?.build_complete          ?? false
  const invoiced               = lotAny?.invoiced                ?? false
  const lotClientExtras        = lotAny?.has_client_extras       ?? true
  const extrasNotes            = lotAny?.extras_notes            ?? null
  const contractPrice          = lotAny?.contract_price != null ? Number(lotAny.contract_price) : null
  const pendingReview          = lotAny?.pending_review          ?? false
  const approvedForInvoicing   = lotAny?.approved_for_invoicing  ?? false
  const delayed                = lotAny?.delayed                ?? false
  const delayReason            = lotAny?.delay_reason            ?? null
  const expectedCompletionDate = lotAny?.expected_completion_date ?? null
  const homeDesign             = lotAny?.home_design             ?? null
  const isCorner                = lotAny?.is_corner                ?? false

  const stage = Array.isArray(lot.stages) ? lot.stages[0] : lot.stages as { id: string; name: string; sites: unknown }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageAny = stage as any
  const stageIsContractPricing   = stageAny?.is_contract_pricing ?? false
  const stageDefaultContractPrice = stageAny?.default_contract_price != null ? Number(stageAny.default_contract_price) : null
  // Lot-level contract_price overrides the stage default; falls back to the
  // stage default when the lot has none set — same COALESCE pattern used on
  // the invoices and analytics pages.
  const effectiveContractPrice = contractPrice ?? stageDefaultContractPrice
  const site             = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string; has_client_extras?: boolean }
  const siteClientExtras = (site as { has_client_extras?: boolean }).has_client_extras ?? true
  const showClientExtras = siteClientExtras && lotClientExtras

  const status = lot.status as LotStatus
  const cfg    = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started

  // Budget vs estimate comparison — supervisor+ only (leading_hand and below
  // never see it). Computed via a service-role query since the estimate side
  // is RLS-locked to admin; supervisor still gets a simplified indicator from
  // the same comparison, just without dollar amounts (see render below).
  const budgetComparison = canSupervise ? await getCachedLotBudgetVsEstimate(lotId) : null

  // Plant ratios for auto-calc
  const ratioSettings = await getCachedPlantRatioSettings()
  const plantRatios = (() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const override = ratioSettings.find((s: any) => s.site_id === site.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const global = ratioSettings.find((s: any) => s.site_id === null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const src = (override ?? global) as any
    const DEFAULT_POT = { '130mm': 75, '200mm': 25 }
    return {
      frontRatio: src?.front_ratio ?? 2.0,
      rearRatio: src?.rear_ratio ?? 1.75,
      frontPotSplit: (src?.front_pot_split ?? src?.pot_size_split ?? DEFAULT_POT) as Record<string, number>,
      rearPotSplit: (src?.rear_pot_split ?? src?.pot_size_split ?? DEFAULT_POT) as Record<string, number>,
    }
  })()

  // Photos
  type PhotoWithUrl = {
    id: string; url: string; photo_type: string; notes: string | null; photo_category: string | null
    uploadedByName: string | null; createdAt: string | null
  }
  let photos: PhotoWithUrl[] = []
  if (photoRows && photoRows.length > 0) {
    const signed = await Promise.all(
      photoRows.map(async (p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pAny = p as any
        const uploader = Array.isArray(pAny.profiles) ? pAny.profiles[0] : pAny.profiles
        const uploadedByName = uploader
          ? `${uploader.first_name ?? ''} ${uploader.last_name ?? ''}`.trim() || null
          : null
        return {
          id: p.id, url: await getR2SignedUrlSafe(p.storage_path), photo_type: p.photo_type,
          notes: (p as { notes?: string | null }).notes ?? null,
          photo_category: (p as { photo_category?: string | null }).photo_category ?? null,
          uploadedByName,
          createdAt: pAny.created_at ?? null,
        }
      })
    )
    photos = signed.filter((p) => p.url)
  }
  const grouped = {
    before: photos.filter((p) => p.photo_type === 'before'),
    during: photos.filter((p) => p.photo_type === 'during'),
    after:  photos.filter((p) => p.photo_type === 'after'),
  }

  // Documents
  type DocWithUrl = { id: string; document_name: string; document_type: string; url: string; storage_path: string; created_at: string }
  let documents: DocWithUrl[] = []
  if (docRows && docRows.length > 0) {
    const signed = await Promise.all(
      docRows.map(async (d) => ({
        id: d.id, document_name: d.document_name, document_type: d.document_type,
        storage_path: d.storage_path, created_at: d.created_at,
        url: await getR2SignedUrlSafe(d.storage_path),
      }))
    )
    documents = signed.filter((d) => d.url)
  }

  // Template sections — unit_price is always passed through so it can be
  // snapshotted when saving quotes. The price *column* is only displayed to admins
  // (controlled by isAdmin inside LotQuantities). Filter admin_only sections for non-admins.
  const sections = showQty
    ? (sectionsData ?? [])
        .filter((s) => !(s as { admin_only?: boolean }).admin_only || isAdmin)
        .map((s) => {
          const isClientExtra = (s as { is_client_extra?: boolean }).is_client_extra ?? false
          return {
            id:             s.id,
            name:           s.name,
            order_index:    s.order_index,
            isClientExtra,
            items: [...((s.quote_template_items as unknown[]) as {
              id: string; name: string; unit: string; unit_price?: number | null;
              is_auto_calculated: boolean; auto_calc_formula: string | null;
              plant_category: 'front' | 'rear' | null; order_index: number; is_active: boolean
            }[] ?? [])]
              .filter((i) => i.is_active !== false)
              .sort((a, b) => a.order_index - b.order_index)
              .map((i) => ({
                ...i,
                unit_price:     i.unit_price ?? null,
                isClientExtra,
              })),
          }
        })
    : []

  // Trade status — gracefully fall back if the table doesn't exist yet
  const tradeStatusRow = tradeStatusResult.error ? null : tradeStatusResult.data
  const tradeStatusProfile = tradeStatusRow
    ? (Array.isArray(tradeStatusRow.profiles) ? tradeStatusRow.profiles[0] : tradeStatusRow.profiles as { first_name: string; last_name: string } | null)
    : null
  const tradeStatus = {
    tradesCompleted: tradeStatusRow?.trades_completed ?? [],
    readyForLandscaping: tradeStatusRow?.ready_for_landscaping ?? false,
    blockingNotes: tradeStatusRow?.blocking_notes ?? null,
    updatedByName: tradeStatusProfile ? `${tradeStatusProfile.first_name} ${tradeStatusProfile.last_name}`.trim() : null,
    updatedAt: tradeStatusRow?.updated_at ?? null,
  }

  // Completion checklist — gracefully fall back if the table doesn't exist yet
  const checklistItems = checklistResult.error ? [] : (checklistResult.data ?? [])

  // Subcontractor costs — gracefully fall back if table doesn't exist yet
  const subcontractorCosts: SubcontractorCostRow[] = subcontractorCostsResult.error
    ? []
    : (subcontractorCostsResult.data ?? []).map((c) => ({
        id:             c.id,
        trade:          c.trade,
        trade_label:    c.trade_label,
        invoice_amount: Number(c.invoice_amount),
        invoice_date:   c.invoice_date,
        notes:          c.notes,
      }))

  // Quotes
  const estimatedQuote = quotesData?.find((q) => q.quote_type === 'estimate') ?? null
  const budgetQuote    = quotesData?.find((q) => q.quote_type === 'budget') ?? null
  const finalQuote     = quotesData?.find((q) => q.quote_type === 'final') ?? null

  function shapeQuote(q: typeof estimatedQuote) {
    if (!q) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = Array.isArray(q.profiles) ? (q.profiles as any)[0] : (q.profiles as any)
    const lastEditedByName = editor ? `${editor.first_name ?? ''} ${editor.last_name ?? ''}`.trim() || null : null
    return {
      id:     q.id,
      status: q.status as 'draft' | 'submitted' | 'approved',
      notes:  q.notes,
      lastEditedByName,
      lastEditedAt: q.last_edited_at as string | null,
      items:  (q.lot_quote_items ?? []).map((i) => ({
        template_item_id:    i.template_item_id as string,
        quantity:            i.quantity as number | null,
        unit_price_snapshot: isAdmin ? (i.unit_price_snapshot as number | null) : null,
      })),
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-fg-muted flex-wrap">
          <Link href="/sites" className="hover:text-fg-secondary">Sites</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}`} className="hover:text-fg-secondary truncate max-w-[100px]">{site.name}</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}/stages/${stageId}`} className="hover:text-fg-secondary truncate max-w-[100px]">{stage.name}</Link>
          <span>/</span>
          <span className="text-fg-secondary font-medium">Lot {lot.lot_number}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-fg">Lot {lot.lot_number}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}>{cfg.label}</span>
        </div>

        {/* Delayed */}
        <DelayControl
          delayed={delayed}
          delayReason={delayReason}
          expectedCompletionDate={expectedCompletionDate}
          canManage={canManage}
          promptLabel="Why is this lot delayed?"
          setAction={setLotDelayed}
          clearAction={clearLotDelayed}
          hiddenFields={{ lot_id: lotId, site_id: siteId, stage_id: stageId }}
        />

        {/* Status toggles — supervisor+ sees Build Complete; admin also sees Invoiced */}
        {canSupervise && (
          <LotStatusToggles
            lotId={lotId}
            siteId={siteId}
            stageId={stageId}
            buildComplete={buildComplete}
            invoiced={invoiced}
            hasClientExtras={lotClientExtras}
            siteHasClientExtras={siteClientExtras}
            pendingReview={pendingReview}
            approvedForInvoicing={approvedForInvoicing}
            canSupervise={canSupervise}
            isAdmin={isAdmin}
          />
        )}

        {/* Info card */}
        <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
          <InfoRow label="Site"      value={site.name} />
          <InfoRow label="Stage"     value={stage.name} />
          <InfoRow label="Due date"  value={formatDate(lot.due_date)}       dim={!lot.due_date} />
          <InfoRow label="Start date" value={formatDate(lot.scheduled_date)} dim={!lot.scheduled_date} />
          {lot.completion_date && <InfoRow label="Completed" value={formatDate(lot.completion_date)} />}
          {lot.notes && (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-fg-muted mb-1">Notes</p>
              <p className="text-sm text-fg-secondary whitespace-pre-wrap">{lot.notes}</p>
            </div>
          )}
        </div>

        {/* ── Trades Completed ──────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-fg-secondary mb-3">Trades Completed</h2>
          <TradeStatusSection
            lotId={lotId}
            siteId={siteId}
            stageId={stageId}
            canManage={canManage}
            tradesCompleted={tradeStatus.tradesCompleted}
            readyForLandscaping={tradeStatus.readyForLandscaping}
            blockingNotes={tradeStatus.blockingNotes}
            updatedByName={tradeStatus.updatedByName}
            updatedAt={tradeStatus.updatedAt}
          />
        </div>

        {/* ── Completion Checklist ──────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-fg-secondary mb-3">Completion Checklist</h2>
          <ChecklistSection
            lotId={lotId}
            siteId={siteId}
            stageId={stageId}
            canManage={canManage}
            savedItems={checklistItems}
            extrasNotes={extrasNotes}
          />
        </div>

        {/* ── Budget vs Estimate indicator — supervisor+ only ─────────────────── */}
        {budgetComparison && (
          <BudgetVsEstimateIndicator {...budgetComparison} isAdmin={isAdmin} />
        )}

        {/* ── Quantities ─────────────────────────────────────────────────────── */}
        {showQty && sections.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-fg-secondary mb-3">Quantities</h2>
            <LotQuantities
              lotId={lotId}
              siteId={siteId}
              stageId={stageId}
              isAdmin={isAdmin}
              canManage={canManage}
              canSupervise={canSupervise}
              sections={sections}
              estimatedQuote={shapeQuote(estimatedQuote)}
              budgetQuote={shapeQuote(budgetQuote)}
              finalQuote={shapeQuote(finalQuote)}
              contractPrice={contractPrice}
              showClientExtras={showClientExtras}
              plantRatios={plantRatios}
            />
          </div>
        )}

        {/* ── Subcontractor Costs (contract-priced lots, admin only) ────────── */}
        {isAdmin && effectiveContractPrice != null && (
          <div>
            <h2 className="text-base font-semibold text-fg-secondary mb-3">Subcontractor Costs</h2>
            <SubcontractorCosts
              lotId={lotId}
              siteId={siteId}
              stageId={stageId}
              initialCosts={subcontractorCosts}
              contractPrice={effectiveContractPrice}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {/* ── Photos ────────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-fg-secondary mb-3">Photos</h2>
          <div className="rounded-xl border border-border bg-surface p-5 mb-4">
            <PhotoUpload
              action={uploadLotPhotoAction}
              hiddenFields={{ lot_id: lotId, site_id: siteId, stage_id: stageId }}
            />
          </div>
          {photos.length > 0 ? (
            <div className="space-y-4">
              {(['before', 'during', 'after'] as const).map((type) => {
                const group = grouped[type]
                if (group.length === 0) return null
                return (
                  <div key={type}>
                    <p className="text-sm font-semibold text-fg-secondary mb-2">
                      {PHOTO_TYPE_LABELS[type]}
                      <span className="ml-1.5 font-normal text-fg-muted">({group.length})</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {group.map((photo) => (
                        <div key={photo.id} className="space-y-1">
                          <a href={photo.url} target="_blank" rel="noopener noreferrer"
                            className="block aspect-square rounded-lg overflow-hidden bg-surface-raised">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt={`${PHOTO_TYPE_LABELS[type]} photo`}
                              className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                          </a>
                          {(photo.photo_category || photo.notes) && (
                            <div className="space-y-0.5">
                              {photo.photo_category && (
                                <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PHOTO_CATEGORY_BADGE_CLASS[photo.photo_category] ?? PHOTO_CATEGORY_BADGE_CLASS.general}`}>
                                  {PHOTO_CATEGORY_LABELS[photo.photo_category] ?? photo.photo_category}
                                </span>
                              )}
                              {photo.notes && (
                                <p className="text-xs text-fg-muted truncate" title={photo.notes}>{photo.notes}</p>
                              )}
                            </div>
                          )}
                          {photo.uploadedByName && photo.createdAt && (
                            <p className="text-xs text-fg-muted truncate">
                              {photo.uploadedByName} · {formatPerthDate(photo.createdAt)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-fg-muted text-center py-4">No photos yet.</p>
          )}
        </div>

        {/* ── Documents ─────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-fg-secondary mb-3">Documents</h2>
          {canManage && (
            <div className="rounded-xl border border-border bg-surface p-5 mb-4">
              <LotDocumentUpload lotId={lotId} siteId={siteId} stageId={stageId} />
            </div>
          )}
          {documents.length > 0 ? (
            <>
              <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
                {documents.map((doc) => (
                  <LotDocumentRow
                    key={doc.id}
                    docId={doc.id}
                    documentName={doc.document_name}
                    documentTypeLabel={DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                    url={doc.url}
                    createdAt={doc.created_at}
                    lotId={lotId}
                    siteId={siteId}
                    stageId={stageId}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
              <LotDocumentPreview documents={documents} />
            </>
          ) : (
            <p className="text-sm text-fg-muted text-center py-4">No documents yet.</p>
          )}
        </div>

        {/* Home design */}
        <HomeDesignField
          lotId={lotId}
          siteId={siteId}
          stageId={stageId}
          homeDesign={homeDesign}
          canEdit={canSupervise}
        />

        {/* ── Edit ──────────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-fg-secondary mb-3">
            {canManage ? 'Edit lot' : 'Update status & notes'}
          </h2>
          <div className="rounded-xl border border-border bg-surface p-5">
            <EditLotForm
              lotId={lotId}
              siteId={siteId}
              stageId={stageId}
              currentStatus={status}
              currentNotes={lot.notes}
              currentDueDate={lot.due_date}
              currentScheduledDate={lot.scheduled_date}
              currentIsCorner={isCorner}
              canManage={canManage}
              canSupervise={canSupervise}
              isAdmin={isAdmin}
              isContractPricing={stageIsContractPricing}
              contractPrice={contractPrice}
              defaultContractPrice={stageDefaultContractPrice}
            />
          </div>
        </div>

      </div>
    </div>
  )
}

function BudgetVsEstimateIndicator({
  budgetTotal, estimateTotal, isAdmin,
}: {
  budgetTotal: number
  estimateTotal: number
  isAdmin: boolean
}) {
  const diff = budgetTotal - estimateTotal
  const pct = estimateTotal > 0 ? (diff / estimateTotal) * 100 : 0
  const overBudget = diff > 0
  const colorClass = overBudget ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-accent-dim text-accent-fg'

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${colorClass}`}>
      {isAdmin ? (
        <>
          Budget: {fmtCurrency(budgetTotal)} · Estimate: {fmtCurrency(estimateTotal)} ·{' '}
          {overBudget
            ? `+${fmtCurrency(diff)} over (${pct.toFixed(0)}%)`
            : `${fmtCurrency(Math.abs(diff))} under (${Math.abs(pct).toFixed(0)}%)`}
        </>
      ) : (
        overBudget ? 'Over budget ⚠️' : 'Under budget ✓'
      )}
    </div>
  )
}

function InfoRow({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <span className="text-sm text-fg-muted shrink-0">{label}</span>
      <span className={`text-sm text-right ${dim ? 'text-fg-muted' : 'text-fg'}`}>{value}</span>

    </div>
  )
}
