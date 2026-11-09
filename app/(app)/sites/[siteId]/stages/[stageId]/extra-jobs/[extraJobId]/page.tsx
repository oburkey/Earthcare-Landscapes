import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getR2SignedUrlSafe } from '@/lib/r2'
import type { ExtraJobStatus } from '@/types/database'
import { EXTRA_JOB_STATUS_CONFIG, PHOTO_TYPE_LABELS, formatDate, formatPerthDateTime, PHOTO_CATEGORY_LABELS, PHOTO_CATEGORY_BADGE_CLASS } from '@/lib/lotStatus'
import { uploadExtraJobPhoto, setExtraJobDelayed, clearExtraJobDelayed } from './actions'
import EditExtraJobForm from './EditExtraJobForm'
import ExtraJobLineItems from './ExtraJobLineItems'
import ExtraJobInvoicingToggles from './ExtraJobInvoicingToggles'
import ExtraJobInlineField from './ExtraJobInlineField'
import { getExtraJobPresetRates } from './pricing-actions'
import { MULCH_PRESET_OPTIONS } from '@/lib/extraJobPresets'
import { EXTRA_JOB_LINES_SELECT, EXTRA_JOB_SECTIONS_SELECT, toExtraJobSections } from '@/lib/extraJobLines'
import PhotoUpload from '@/app/_components/PhotoUpload'
import DelayControl from '@/app/_components/DelayControl'
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
    { data: existingItems },
    { data: existingSections },
    presetRates,
    { data: linesVersion },
  ] = await Promise.all([
    supabase
      .from('extra_jobs')
      .select(`
        id, title, description, status, notes, due_date, source_quote_id, delayed, delay_reason, expected_completion_date,
        pending_review, approved_for_invoicing, updated_at,
        stages!inner(
          id, name,
          sites!inner(id, name)
        )
      `)
      .eq('id', extraJobId)
      .single(),
    supabase
      .from('extra_job_photos')
      .select('id, storage_path, photo_type, notes, photo_category, created_at')
      .eq('extra_job_id', extraJobId)
      .order('created_at', { ascending: true }),
    supabase
      .from('extra_job_quote_items')
      .select(EXTRA_JOB_LINES_SELECT)
      .eq('extra_job_id', extraJobId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('extra_job_sections')
      .select(EXTRA_JOB_SECTIONS_SELECT)
      .eq('extra_job_id', extraJobId),
    getExtraJobPresetRates(),
    // Separate query so a missing migration column can't stop the page loading
    supabase
      .from('extra_jobs')
      .select('lines_updated_at, profiles!updated_by(first_name, last_name)')
      .eq('id', extraJobId)
      .maybeSingle(),
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
    lineItems: { description: string; qty: number; unit: string; rate: number; optional: boolean }[];
    notes: string;
  } | null = null

  if (sourceQuoteId) {
    try {
      const { data: sq } = await supabase
        .from('quotes')
        .select('reference, description, notes, sites(name), quote_sections(order_index, exclude_from_total, quote_line_items(description, qty, unit, rate, order_index))')
        .eq('id', sourceQuoteId)
        .single()
      if (sq) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sqAny = sq as any
        // Optional (below-the-total) sections are kept but flagged, so the
        // source quote reads like the original (they may or may not have been
        // carried into this job — see convertQuoteToExtraJob).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const flatItems = ((sqAny.quote_sections ?? []) as any[])
          .slice()
          .sort((a, b) => Number(!!a.exclude_from_total) - Number(!!b.exclude_from_total) || a.order_index - b.order_index)
          .flatMap((s) =>
            ((s.quote_line_items ?? []) as { description: string; qty: number; unit: string; rate: number; order_index: number }[])
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map((li) => ({ ...li, optional: !!s.exclude_from_total }))
          )
        sourceQuote = {
          siteName:    sqAny.sites?.name ?? null,
          reference:   sqAny.reference ?? '',
          description: sqAny.description ?? '',
          lineItems:   flatItems.map((li) =>
            isAdmin ? li : { description: li.description, qty: li.qty, unit: li.unit, rate: 0, optional: li.optional }
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

  type PhotoWithUrl = { id: string; url: string; photo_type: string; notes: string | null; photo_category: string | null }
  let photos: PhotoWithUrl[] = []
  if (photoRows && photoRows.length > 0) {
    const signed = await Promise.all(
      photoRows.map(async (p) => ({
        id: p.id, url: await getR2SignedUrlSafe(p.storage_path), photo_type: p.photo_type,
        notes: (p as { notes?: string | null }).notes ?? null,
        photo_category: (p as { photo_category?: string | null }).photo_category ?? null,
      }))
    )
    photos = signed.filter((p) => p.url)
  }

  const grouped = {
    before: photos.filter((p) => p.photo_type === 'before'),
    during: photos.filter((p) => p.photo_type === 'during'),
    after:  photos.filter((p) => p.photo_type === 'after'),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dueDate = (job as any).due_date as string | null

  // Last edited — any change to the job row (details, status, line saves,
  // toggles). The name is missing for system writes and for edits made
  // before migration_extra_job_sections.sql.
  const editorRaw = (linesVersion as { profiles?: unknown } | null)?.profiles
  const editor = (Array.isArray(editorRaw) ? editorRaw[0] : editorRaw) as { first_name: string | null; last_name: string | null } | null | undefined
  const editorName = editor ? [editor.first_name, editor.last_name].filter(Boolean).join(' ') : ''
  const updatedAt = (job as { updated_at?: string | null }).updated_at ?? null

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-fg-muted flex-wrap">
          <Link href="/sites" className="hover:text-fg-secondary">Sites</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}`} className="hover:text-fg-secondary truncate max-w-[80px] sm:max-w-[200px]">{site.name}</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}/stages/${stageId}`} className="hover:text-fg-secondary truncate max-w-[80px] sm:max-w-[200px]">{stage.name}</Link>
          <span>/</span>
          <span className="text-fg-secondary font-medium truncate max-w-[100px] sm:max-w-[280px]">{job.title}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 flex-1 text-xl font-semibold text-fg">
            <ExtraJobInlineField
              extraJobId={extraJobId}
              siteId={siteId}
              stageId={stageId}
              field="title"
              value={job.title}
              canEdit={canManage}
            />
          </h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
        {canManage && updatedAt && (
          <p className="-mt-3 text-xs text-fg-muted">
            {editorName ? `Last edited by ${editorName}` : 'Last edited'} · {formatPerthDateTime(updatedAt)}
          </p>
        )}

        {/* Invoicing — admin only, same rules as the Invoices page */}
        {isAdmin && (
          <ExtraJobInvoicingToggles
            extraJobId={extraJobId}
            siteId={siteId}
            stageId={stageId}
            pendingReview={(job as { pending_review?: boolean }).pending_review ?? false}
            approvedForInvoicing={(job as { approved_for_invoicing?: boolean }).approved_for_invoicing ?? false}
          />
        )}

        {/* Delayed */}
        <DelayControl
          delayed={(job as unknown as { delayed?: boolean }).delayed ?? false}
          delayReason={(job as unknown as { delay_reason?: string | null }).delay_reason ?? null}
          expectedCompletionDate={(job as unknown as { expected_completion_date?: string | null }).expected_completion_date ?? null}
          canManage={canManage}
          promptLabel="Why is this job delayed?"
          setAction={setExtraJobDelayed}
          clearAction={clearExtraJobDelayed}
          hiddenFields={{ extra_job_id: extraJobId, site_id: siteId, stage_id: stageId }}
        />

        {/* Details — single card of label/value rows, same pattern as the lot detail page */}
        {(job.description || job.notes || dueDate || canManage) && (
          <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
            {dueDate && <InfoRow label="Due date" value={formatDate(dueDate)} />}
            {/* Edited in place by leading hand+; shown read-only to workers */}
            {(job.description || canManage) && (
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-fg-muted mb-1">Description</p>
                <ExtraJobInlineField
                  extraJobId={extraJobId}
                  siteId={siteId}
                  stageId={stageId}
                  field="description"
                  value={job.description ?? ''}
                  canEdit={canManage}
                  placeholder="Add a description…"
                  className="text-sm text-fg-secondary"
                />
              </div>
            )}
            {job.notes && (
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-fg-muted mb-1">Notes</p>
                <p className="text-sm text-fg-secondary whitespace-pre-wrap">{job.notes}</p>
              </div>
            )}
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
          <h2 className="text-base font-semibold text-fg-secondary mb-3">Photos</h2>

          <div className="rounded-xl border border-border bg-surface p-5 mb-4">
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
                    <p className="text-sm font-semibold text-fg-secondary mb-2">
                      {PHOTO_TYPE_LABELS[type]}
                      <span className="ml-1.5 font-normal text-fg-muted">({group.length})</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {group.map((photo) => (
                        <div key={photo.id} className="space-y-1">
                          <a
                            href={photo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-square rounded-lg overflow-hidden bg-surface-raised"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.url}
                              alt={`${PHOTO_TYPE_LABELS[type]} photo`}
                              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                            />
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

        {/* Line items */}
        <div>
          <h2 className="text-base font-semibold text-fg-secondary mb-3">Line items</h2>
          <ExtraJobLineItems
            extraJobId={extraJobId}
            siteId={siteId}
            stageId={stageId}
            canManage={canManage}
            isAdmin={isAdmin}
            existingSections={toExtraJobSections(existingSections ?? [], existingItems ?? [], isAdmin)}
            linesUpdatedAt={(linesVersion as { lines_updated_at?: string | null } | null)?.lines_updated_at ?? null}
            presets={{
              labourRate:   isAdmin ? presetRates.labour : null,
              bobcatRate:   isAdmin ? presetRates.bobcat : null,
              edgingRate:   isAdmin ? presetRates.edging : null,
              turfRate:     isAdmin ? presetRates.turf   : null,
              mulchOptions: MULCH_PRESET_OPTIONS.map((opt) => ({
                key:      opt.key,
                label:    opt.label,
                itemName: opt.itemName,
                rate:     isAdmin ? (presetRates[opt.key] ?? null) : null,
              })),
            }}
          />
        </div>

        {/* Edit section */}
        <div>
          <h2 className="text-base font-semibold text-fg-secondary mb-3">
            {canManage ? 'Edit job' : 'Update status & notes'}
          </h2>
          <div className="rounded-xl border border-border bg-surface p-5">
            <EditExtraJobForm
              extraJobId={extraJobId}
              siteId={siteId}
              stageId={stageId}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <span className="text-sm text-fg-muted shrink-0">{label}</span>
      <span className="text-sm text-right text-fg">{value}</span>
    </div>
  )
}
