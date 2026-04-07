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
import { getR2SignedUrl } from '@/lib/r2'

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
  const canManage = profile.role === 'leading_hand' || profile.role === 'supervisor' || profile.role === 'admin'
  const isAdmin   = profile.role === 'admin'
  const showQty   = profile.role !== 'worker' && profile.role !== 'client'

  const supabase = await createClient()

  const [
    { data: lot },
    { data: photoRows },
    { data: docRows },
    { data: sectionsData },
    { data: quotesData },
  ] = await Promise.all([
    supabase
      .from('lots')
      .select(`
        id, lot_number, status, due_date, scheduled_date, completion_date, notes,
        stages!inner(id, name, sites!inner(id, name))
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
            id, name, order_index,
            quote_template_items (
              id, name, unit, ${isAdmin ? 'unit_price,' : ''}
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
  ])

  if (!lot) notFound()

  const stage = Array.isArray(lot.stages) ? lot.stages[0] : lot.stages as { id: string; name: string; sites: unknown }
  const site  = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string }

  const status = lot.status as LotStatus
  const cfg    = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started

  // Photos
  type PhotoWithUrl = { id: string; url: string; photo_type: string }
  let photos: PhotoWithUrl[] = []
  if (photoRows && photoRows.length > 0) {
    const signed = await Promise.all(
      photoRows.map(async (p) => {
        try   { return { id: p.id, url: await getR2SignedUrl(p.storage_path, 3600), photo_type: p.photo_type } }
        catch { return { id: p.id, url: '', photo_type: p.photo_type } }
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
  type DocWithUrl = { id: string; document_name: string; document_type: string; url: string }
  let documents: DocWithUrl[] = []
  if (docRows && docRows.length > 0) {
    const signed = await Promise.all(
      docRows.map(async (d) => {
        try   { return { id: d.id, document_name: d.document_name, document_type: d.document_type, url: await getR2SignedUrl(d.storage_path, 3600) } }
        catch { return { id: d.id, document_name: d.document_name, document_type: d.document_type, url: '' } }
      })
    )
    documents = signed.filter((d) => d.url)
  }

  // Template sections (shape items for client component, strip unit_price for non-admin)
  const sections = showQty
    ? (sectionsData ?? []).map((s) => ({
        id:          s.id,
        name:        s.name,
        order_index: s.order_index,
        items: [...((s.quote_template_items as unknown[]) as {
          id: string; name: string; unit: string; unit_price?: number | null;
          is_auto_calculated: boolean; auto_calc_formula: string | null;
          plant_category: 'front' | 'rear' | null; order_index: number
        }[] ?? [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map((i) => ({
            ...i,
            unit_price: isAdmin ? (i.unit_price ?? null) : null,
          })),
      }))
    : []

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
