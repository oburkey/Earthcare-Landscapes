import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getR2SignedUrlSafe } from '@/lib/r2'
import type { ExtraJobStatus } from '@/types/database'
import { EXTRA_JOB_STATUS_CONFIG, PHOTO_TYPE_LABELS, formatDate } from '@/lib/lotStatus'
import { uploadExtraJobPhoto } from './actions'
import EditExtraJobForm from './EditExtraJobForm'
import ExtraJobPricing from './ExtraJobPricing'
import PhotoUpload from '@/app/_components/PhotoUpload'
import SourceQuotePdf from './SourceQuotePdf'

interface Props {
  params: Promise<{ siteId: string; stageId: string; extraJobId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { extraJobId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('extra_jobs')
    .select('title')
    .eq('id', extraJobId)
    .single()
  return { title: data ? `${data.title} — Earthcare Landscapes` : 'Extra Job' }
}

async function uploadExtraJobPhotoAction(formData: FormData) {
  'use server'
  return uploadExtraJobPhoto(null, formData)
}

export default async function ExtraJobPage({ params }: Props) {
  const { siteId, stageId, extraJobId } = await params
  const profile = await requireAuth()
  const canManage = profile.role === 'leading_hand' || profile.role === 'supervisor' || profile.role === 'admin'
  const isAdmin   = profile.role === 'admin'

  const supabase = await createClient()

  const [
    { data: job },
    { data: photoRows },
    { data: sectionsData },
    { data: existingItems },
  ] = await Promise.all([
    supabase
      .from('extra_jobs')
      .select(`
        id, title, description, status, notes, due_date, source_quote_id,
        stages!inner(
          id, name,
          sites!inner(id, name)
        )
      `)
      .eq('id', extraJobId)
      .single(),
    supabase
      .from('extra_job_photos')
      .select('id, storage_path, photo_type, created_at')
      .eq('extra_job_id', extraJobId)
      .order('created_at', { ascending: true }),
    supabase
      .from('quote_template_sections')
      .select(`
        id, name, order_index,
        quote_template_items(id, name, unit, unit_price, is_auto_calculated, order_index)
      `)
      .eq('is_active', true)
      .eq('is_client_extra', false)
      .order('order_index', { ascending: true }),
    supabase
      .from('extra_job_quote_items')
      .select('template_item_id, description, unit, quantity, unit_price, item_type, sort_order')
      .eq('extra_job_id', extraJobId)
      .order('sort_order', { ascending: true }),
  ])

  if (!job) notFound()

  const stage = Array.isArray(job.stages)
    ? job.stages[0]
    : (job.stages as { id: string; name: string; sites: unknown })
  const site = Array.isArray(stage.sites)
    ? stage.sites[0]
    : (stage.sites as { id: string; name: string })

  // Fetch source quote if this job was converted from a quote
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceQuoteId = (job as any).source_quote_id as string | null
  let sourceQuote: {
    siteName: string | null; reference: string; description: string;
    lineItems: { description: string; qty: number; unit: string; rate: number }[];
    notes: string;
  } | null = null

  if (sourceQuoteId) {
    try {
      const { data: sq } = await supabase
        .from('quotes')
        .select('reference, description, line_items, notes, sites(name)')
        .eq('id', sourceQuoteId)
        .single()
      if (sq) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sqAny = sq as any
        sourceQuote = {
          siteName:    sqAny.sites?.name ?? null,
          reference:   sqAny.reference ?? '',
          description: sqAny.description ?? '',
          lineItems:   (Array.isArray(sqAny.line_items) ? sqAny.line_items : []).map(
            (li: { description: string; qty: number; unit: string; rate: number }) =>
              isAdmin ? li : { description: li.description, qty: li.qty, unit: li.unit, rate: 0 }
          ),
          notes:       sqAny.notes ?? '',
        }
      }
    } catch {
      // quotes table may not exist yet
    }
  }

  const status = job.status as ExtraJobStatus
  const cfg = EXTRA_JOB_STATUS_CONFIG[status] ?? EXTRA_JOB_STATUS_CONFIG.not_started

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

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-stone-500 flex-wrap">
          <Link href="/sites" className="hover:text-stone-700">Sites</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}`} className="hover:text-stone-700 truncate max-w-[80px]">{site.name}</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}/stages/${stageId}`} className="hover:text-stone-700 truncate max-w-[80px]">{stage.name}</Link>
          <span>/</span>
          <span className="text-stone-700 font-medium truncate max-w-[100px]">{job.title}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-stone-900">{job.title}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>

        {/* Info card */}
        {job.description && (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-stone-500 mb-1">Description</p>
            <p className="text-sm text-stone-800">{job.description}</p>
          </div>
        )}

        {job.notes && (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-stone-500 mb-1">Notes</p>
            <p className="text-sm text-stone-800 whitespace-pre-wrap">{job.notes}</p>
          </div>
        )}

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(job as any).due_date && (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-stone-500 mb-1">Due date</p>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <p className="text-sm text-stone-800">{formatDate((job as any).due_date)}</p>
          </div>
        )}

        {/* Source quote link */}
        {sourceQuote && (
          <SourceQuotePdf
            siteName={sourceQuote.siteName}
            reference={sourceQuote.reference}
            description={sourceQuote.description}
            lineItems={sourceQuote.lineItems}
            notes={sourceQuote.notes}
            isAdmin={isAdmin}
          />
        )}

        {/* Photos */}
        <div>
          <h2 className="text-base font-semibold text-stone-800 mb-3">Photos</h2>

          <div className="rounded-xl border border-stone-200 bg-white p-5 mb-4">
            <PhotoUpload
                action={uploadExtraJobPhotoAction}
                hiddenFields={{ extra_job_id: extraJobId, site_id: siteId, stage_id: stageId }}
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
                        <a
                          key={photo.id}
                          href={photo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block aspect-square rounded-lg overflow-hidden bg-stone-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt={`${PHOTO_TYPE_LABELS[type]} photo`}
                            className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                          />
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

        {/* Pricing */}
        <div>
          <h2 className="text-base font-semibold text-stone-800 mb-3">Pricing</h2>
          <ExtraJobPricing
            extraJobId={extraJobId}
            siteId={siteId}
            stageId={stageId}
            isAdmin={isAdmin}
            sections={(sectionsData ?? []).map((s) => ({
              id:          s.id,
              name:        s.name,
              order_index: s.order_index,
              items: [...((s.quote_template_items as unknown[]) as {
                id: string; name: string; unit: string; unit_price: number | null;
                is_auto_calculated: boolean; order_index: number
              }[] ?? [])]
                .sort((a, b) => a.order_index - b.order_index)
                .map((item) => ({ ...item, unit_price: isAdmin ? item.unit_price : null })),
            }))}
            existingItems={(existingItems ?? []).map((i) => ({
              template_item_id: i.template_item_id ?? null,
              description:      i.description ?? null,
              unit:             i.unit,
              quantity:         i.quantity !== null ? Number(i.quantity) : null,
              unit_price:       isAdmin && i.unit_price !== null ? Number(i.unit_price) : null,
              item_type:        i.item_type,
            }))}
            canManage={canManage}
          />
        </div>

        {/* Edit section */}
        <div>
          <h2 className="text-base font-semibold text-stone-800 mb-3">
            {canManage ? 'Edit job' : 'Update status & notes'}
          </h2>
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <EditExtraJobForm
              extraJobId={extraJobId}
              siteId={siteId}
              stageId={stageId}
              currentTitle={job.title}
              currentDescription={job.description}
              currentStatus={status}
              currentNotes={job.notes}
              currentDueDate={(job as unknown as { due_date?: string | null }).due_date ?? null}
              canManage={canManage}
              isAdmin={profile.role === 'admin'}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
