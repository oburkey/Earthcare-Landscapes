import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { STATUS_CONFIG, formatDate, PHOTO_TYPE_LABELS, DOC_TYPE_LABELS } from '@/lib/lotStatus'
import type { LotStatus } from '@/types/database'
import { uploadLotPhoto } from './actions'
import EditLotForm from './EditLotForm'
import PhotoUpload from '@/app/_components/PhotoUpload'
import LotDocumentUpload from './LotDocumentUpload'
import LotQuantities from './LotQuantities'
import LotStatusToggles from './LotStatusToggles'
import TradeStatusSection from './TradeStatusSection'
import ChecklistSection from './ChecklistSection'
import { getR2SignedUrlSafe } from '@/lib/r2'

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
  ] = await Promise.all([
    supabase
      .from('lots')
      .select(`
        id, lot_number, status, due_date, scheduled_date, completion_date, notes,
        build_complete, quant_done, invoiced, has_client_extras, extras_notes,
        stages!inner(id, name, sites!inner(id, name, has_client_extras))
      `)
      .eq('id', lotId)
      .single(),
    supabase
      .from('lot_photos')
      .select('id, storage_path, photo_type, created_at')
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
              is_auto_calculated, auto_calc_formula, plant_category, order_index
            )
          `)
          .eq('is_active', true)
          .order('order_index', { ascending: true })
      : Promise.resolve({ data: null }),
    // Existing quotes for this lot (both estimated and final)
    showQty
      ? supabase
          .from('lot_quotes')
          .select(`
            id, is_estimated, status, notes,
            lot_quote_items (template_item_id, quantity, unit_price_snapshot)
          `)
          .eq('lot_id', lotId)
      : Promise.resolve({ data: null }),
    // Trade status — table may not exist yet, handled gracefully below
    supabase
      .from('lot_trade_status')
      .select('trades_completed, ready_for_landscaping, blocking_notes, updated_at, profiles(full_name)')
      .eq('lot_id', lotId)
      .maybeSingle(),
    // Completion checklist — table may not exist yet, handled gracefully below
    supabase
      .from('lot_checklist_items')
      .select('item_key, completed, response, completed_date')
      .eq('lot_id', lotId),
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
  const buildComplete   = lotAny?.build_complete   ?? false
  const quantDone       = lotAny?.quant_done       ?? false
  const invoiced        = lotAny?.invoiced          ?? false
  const lotClientExtras = lotAny?.has_client_extras ?? true
  const extrasNotes     = lotAny?.extras_notes      ?? null

  const stage = Array.isArray(lot.stages) ? lot.stages[0] : lot.stages as { id: string; name: string; sites: unknown }
  const site             = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string; has_client_extras?: boolean }
  const siteClientExtras = (site as { has_client_extras?: boolean }).has_client_extras ?? true
  const showClientExtras = siteClientExtras && lotClientExtras

  const status = lot.status as LotStatus
  const cfg    = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started

  // Photos
  type PhotoWithUrl = { id: string; url: string; photo_type: string }
  let photos: PhotoWithUrl[] = []
  if (photoRows && photoRows.length > 0) {
    const signed = await Promise.all(
      photoRows.map(async (p) => ({
        id: p.id, url: await getR2SignedUrlSafe(p.storage_path), photo_type: p.photo_type,
      }))
    )
    photos = signed.filter((p) => p.url)
  }
  const grouped = {
    before: photos.filter((p) => p.photo_type === 'before'),
    during: photos.filter((p) => p.photo_type === 'during'),
    after:  photos.filter((p) => p.photo_type === 'after'),
  }

  // Documents
  type DocWithUrl = { id: string; document_name: string; document_type: string; url: string }
  let documents: DocWithUrl[] = []
  if (docRows && docRows.length > 0) {
    const signed = await Promise.all(
      docRows.map(async (d) => ({
        id: d.id, document_name: d.document_name, document_type: d.document_type,
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
              plant_category: 'front' | 'rear' | null; order_index: number
            }[] ?? [])]
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
    ? (Array.isArray(tradeStatusRow.profiles) ? tradeStatusRow.profiles[0] : tradeStatusRow.profiles as { full_name: string } | null)
    : null
  const tradeStatus = {
    tradesCompleted: tradeStatusRow?.trades_completed ?? [],
    readyForLandscaping: tradeStatusRow?.ready_for_landscaping ?? false,
    blockingNotes: tradeStatusRow?.blocking_notes ?? null,
    updatedByName: tradeStatusProfile?.full_name ?? null,
    updatedAt: tradeStatusRow?.updated_at ?? null,
  }

  // Completion checklist — gracefully fall back if the table doesn't exist yet
  const checklistItems = checklistResult.error ? [] : (checklistResult.data ?? [])

  // Quotes
  const estimatedQuote = quotesData?.find((q) => q.is_estimated) ?? null
  const finalQuote     = quotesData?.find((q) => !q.is_estimated) ?? null

  function shapeQuote(q: typeof estimatedQuote) {
    if (!q) return null
    return {
      id:     q.id,
      status: q.status as 'draft' | 'submitted' | 'approved',
      notes:  q.notes,
      items:  (q.lot_quote_items ?? []).map((i) => ({
        template_item_id:    i.template_item_id as string,
        quantity:            i.quantity as number | null,
        unit_price_snapshot: isAdmin ? (i.unit_price_snapshot as number | null) : null,
      })),
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-stone-500 flex-wrap">
          <Link href="/sites" className="hover:text-stone-700">Sites</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}`} className="hover:text-stone-700 truncate max-w-[100px]">{site.name}</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}/stages/${stageId}`} className="hover:text-stone-700 truncate max-w-[100px]">{stage.name}</Link>
          <span>/</span>
          <span className="text-stone-700 font-medium">Lot {lot.lot_number}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-stone-900">Lot {lot.lot_number}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}>{cfg.label}</span>
        </div>

        {/* Status toggles — supervisor+ sees Build Complete & Quant Done; admin also sees Invoiced */}
        {canSupervise && (
          <LotStatusToggles
            lotId={lotId}
            siteId={siteId}
            stageId={stageId}
            buildComplete={buildComplete}
            quantDone={quantDone}
            invoiced={invoiced}
            hasClientExtras={lotClientExtras}
            siteHasClientExtras={siteClientExtras}
            canSupervise={canSupervise}
            isAdmin={isAdmin}
          />
        )}

        {/* Info card */}
        <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 overflow-hidden">
          <InfoRow label="Site"      value={site.name} />
          <InfoRow label="Stage"     value={stage.name} />
          <InfoRow label="Due date"  value={formatDate(lot.due_date)}       dim={!lot.due_date} />
          <InfoRow label="Scheduled" value={formatDate(lot.scheduled_date)} dim={!lot.scheduled_date} />
          {lot.completion_date && <InfoRow label="Completed" value={formatDate(lot.completion_date)} />}
          {lot.notes && (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-stone-500 mb-1">Notes</p>
              <p className="text-sm text-stone-800 whitespace-pre-wrap">{lot.notes}</p>
            </div>
          )}
        </div>

        {/* ── Trades Completed ──────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-stone-800 mb-3">Trades Completed</h2>
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
          <h2 className="text-base font-semibold text-stone-800 mb-3">Completion Checklist</h2>
          <ChecklistSection
            lotId={lotId}
            siteId={siteId}
            stageId={stageId}
            canManage={canManage}
            savedItems={checklistItems}
            extrasNotes={extrasNotes}
          />
        </div>

        {/* ── Quantities ─────────────────────────────────────────────────────── */}
        {showQty && sections.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-stone-800 mb-3">Quantities</h2>
            <LotQuantities
              lotId={lotId}
              siteId={siteId}
              stageId={stageId}
              isAdmin={isAdmin}
              canManage={canManage}
              sections={sections}
              estimatedQuote={shapeQuote(estimatedQuote)}
              finalQuote={shapeQuote(finalQuote)}
              showClientExtras={showClientExtras}
            />
          </div>
        )}

        {/* ── Photos ────────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-stone-800 mb-3">Photos</h2>
          <div className="rounded-xl border border-stone-200 bg-white p-5 mb-4">
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
                    <p className="text-sm font-semibold text-stone-600 mb-2">
                      {PHOTO_TYPE_LABELS[type]}
                      <span className="ml-1.5 font-normal text-stone-400">({group.length})</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {group.map((photo) => (
                        <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer"
                          className="block aspect-square rounded-lg overflow-hidden bg-stone-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt={`${PHOTO_TYPE_LABELS[type]} photo`}
                            className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-stone-400 text-center py-4">No photos yet.</p>
          )}
        </div>

        {/* ── Documents ─────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-stone-800 mb-3">Documents</h2>
          {canManage && (
            <div className="rounded-xl border border-stone-200 bg-white p-5 mb-4">
              <LotDocumentUpload lotId={lotId} siteId={siteId} stageId={stageId} />
            </div>
          )}
          {documents.length > 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-900 truncate">{doc.document_name}</p>
                    <p className="text-xs text-stone-500">{DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</p>
                  </div>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
                    View PDF
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400 text-center py-4">No documents yet.</p>
          )}
        </div>

        {/* ── Edit ──────────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-stone-800 mb-3">
            {canManage ? 'Edit lot' : 'Update status & notes'}
          </h2>
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <EditLotForm
              lotId={lotId}
              siteId={siteId}
              stageId={stageId}
              currentStatus={status}
              currentNotes={lot.notes}
              currentDueDate={lot.due_date}
              currentScheduledDate={lot.scheduled_date}
              canManage={canManage}
              isAdmin={isAdmin}
            />
          </div>
        </div>

      </div>
    </div>
  )
}

function InfoRow({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <span className="text-sm text-stone-500 shrink-0">{label}</span>
      <span className={`text-sm text-right ${dim ? 'text-stone-400' : 'text-stone-900'}`}>{value}</span>
    </div>
  )
}
