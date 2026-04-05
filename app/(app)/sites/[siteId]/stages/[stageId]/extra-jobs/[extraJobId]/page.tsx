import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getR2SignedUrl } from '@/lib/r2'
import type { ExtraJobStatus } from '@/types/database'
import EditExtraJobForm from './EditExtraJobForm'
import ExtraJobPhotoUpload from './ExtraJobPhotoUpload'

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

const STATUS_CONFIG: Record<ExtraJobStatus, { label: string; badge: string }> = {
  not_started: { label: 'Not started', badge: 'bg-stone-100 text-stone-600' },
  in_progress: { label: 'In progress', badge: 'bg-blue-100 text-blue-700' },
  complete:    { label: 'Complete',    badge: 'bg-green-100 text-green-700' },
}

const PHOTO_TYPE_LABELS: Record<string, string> = {
  before: 'Before',
  during: 'During',
  after:  'After',
}

export default async function ExtraJobPage({ params }: Props) {
  const { siteId, stageId, extraJobId } = await params
  const profile = await requireAuth()
  const canManage = profile.role === 'leading_hand' || profile.role === 'supervisor' || profile.role === 'admin'

  const supabase = await createClient()

  const [{ data: job }, { data: photoRows }] = await Promise.all([
    supabase
      .from('extra_jobs')
      .select(`
        id, title, description, status, notes,
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
  ])

  if (!job) notFound()

  const stage = Array.isArray(job.stages)
    ? job.stages[0]
    : (job.stages as { id: string; name: string; sites: unknown })
  const site = Array.isArray(stage.sites)
    ? stage.sites[0]
    : (stage.sites as { id: string; name: string })

  const status = job.status as ExtraJobStatus
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started

  type PhotoWithUrl = { id: string; url: string; photo_type: string }
  let photos: PhotoWithUrl[] = []
  if (photoRows && photoRows.length > 0) {
    const signed = await Promise.all(
      photoRows.map(async (p) => {
        try {
          const url = await getR2SignedUrl(p.storage_path, 3600)
          return { id: p.id, url, photo_type: p.photo_type }
        } catch {
          return { id: p.id, url: '', photo_type: p.photo_type }
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

        {/* Photos */}
        <div>
          <h2 className="text-base font-semibold text-stone-800 mb-3">Photos</h2>

          <div className="rounded-xl border border-stone-200 bg-white p-5 mb-4">
            <ExtraJobPhotoUpload extraJobId={extraJobId} siteId={siteId} stageId={stageId} />
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
              canManage={canManage}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
