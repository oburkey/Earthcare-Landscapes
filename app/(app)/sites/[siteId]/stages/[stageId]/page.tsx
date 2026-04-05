import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { STATUS_CONFIG, formatDate } from '@/lib/lotStatus'
import type { LotStatus, ExtraJobStatus } from '@/types/database'
import { uploadStagePlan } from './actions'
import PlanPhotoUpload from '../../PlanPhotoUpload'
import EditStageForm from './EditStageForm'
import { getR2SignedUrl } from '@/lib/r2'

interface Props {
  params: Promise<{ siteId: string; stageId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { stageId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('stages')
    .select('name, sites(name)')
    .eq('id', stageId)
    .single()
  const siteName = Array.isArray(data?.sites) ? data.sites[0]?.name : (data?.sites as unknown as { name: string } | null)?.name
  return {
    title: data ? `${data.name} — ${siteName} — Earthcare Landscapes` : 'Stage',
  }
}

const EXTRA_JOB_STATUS_CONFIG: Record<ExtraJobStatus, { label: string; badge: string }> = {
  not_started: { label: 'Not started', badge: 'bg-stone-100 text-stone-600' },
  in_progress: { label: 'In progress', badge: 'bg-blue-100 text-blue-700' },
  complete:    { label: 'Complete',    badge: 'bg-green-100 text-green-700' },
}

export default async function StagePage({ params }: Props) {
  const { siteId, stageId } = await params
  const profile = await requireAuth()
  const canAddLot = profile.role === 'leading_hand' || profile.role === 'supervisor' || profile.role === 'admin'
  const canManageExtraJobs = profile.role === 'leading_hand' || profile.role === 'supervisor' || profile.role === 'admin'
  const canManageStage = profile.role === 'supervisor' || profile.role === 'admin'
  const isAdmin = profile.role === 'admin'

  const supabase = await createClient()

  const [{ data: stage }, { data: extraJobs }] = await Promise.all([
    supabase
      .from('stages')
      .select(`
        id, name, site_plan_path,
        sites!inner(id, name),
        lots(
          id, lot_number, status, due_date, scheduled_date
        )
      `)
      .eq('id', stageId)
      .single(),
    supabase
      .from('extra_jobs')
      .select('id, title, status, description')
      .eq('stage_id', stageId)
      .order('created_at', { ascending: true }),
  ])

  if (!stage) notFound()

  const site = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string }
  const lots = [...(stage.lots ?? [])].sort((a, b) =>
    a.lot_number.localeCompare(b.lot_number, undefined, { numeric: true })
  )

  const total = lots.length
  const completed = lots.filter((l) => l.status === 'complete').length

  // Generate R2 signed URL for the stage plan if one exists
  let stagePlanUrl: string | null = null
  if (stage.site_plan_path) {
    try {
      stagePlanUrl = await getR2SignedUrl(stage.site_plan_path, 3600)
    } catch {
      stagePlanUrl = null
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-stone-500">
          <Link href="/sites" className="hover:text-stone-700">Sites</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}`} className="hover:text-stone-700 truncate max-w-[120px]">
            {site.name}
          </Link>
          <span>/</span>
          <span className="text-stone-700 font-medium">{stage.name}</span>
        </nav>

        {/* Stage header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-stone-900">{stage.name}</h1>
              {canManageStage && (
                <EditStageForm siteId={siteId} stageId={stageId} name={stage.name} />
              )}
            </div>
            {total > 0 && (
              <p className="mt-0.5 text-sm text-stone-500">
                {completed}/{total} lots complete
              </p>
            )}
          </div>
          {canAddLot && (
            <Link
              href={`/sites/${siteId}/stages/${stageId}/new-lot`}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900 shrink-0"
            >
              + Add lot
            </Link>
          )}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="h-2 w-full rounded-full bg-stone-100">
            <div
              className="h-2 rounded-full bg-green-600 transition-all"
              style={{ width: `${Math.round((completed / total) * 100)}%` }}
            />
          </div>
        )}

        {/* ── Stage plan ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-stone-800">Stage plan</h2>
          </div>

          {stagePlanUrl ? (
            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              <a href={stagePlanUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={stagePlanUrl}
                  alt="Stage plan"
                  className="w-full object-contain max-h-[60vh] hover:opacity-95 transition-opacity"
                />
              </a>
              {isAdmin && (
                <div className="p-4 border-t border-stone-100">
                  <PlanPhotoUpload
                    action={uploadStagePlan}
                    hiddenFields={{ site_id: siteId, stage_id: stageId }}
                    hasPlan={true}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              {isAdmin ? (
                <PlanPhotoUpload
                  action={uploadStagePlan}
                  hiddenFields={{ site_id: siteId, stage_id: stageId }}
                  hasPlan={false}
                />
              ) : (
                <p className="text-sm text-stone-400 text-center py-4">No stage plan uploaded yet.</p>
              )}
            </div>
          )}
        </div>

        {/* ── Lots list ─────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-stone-800 mb-3">Lots</h2>

          {lots.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-12 text-center">
              <p className="text-sm text-stone-500">No lots in this stage yet.</p>
              {canAddLot && (
                <Link
                  href={`/sites/${siteId}/stages/${stageId}/new-lot`}
                  className="mt-3 inline-block text-sm font-medium text-green-700 hover:underline"
                >
                  Add the first lot →
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
              {lots.map((lot) => {
                const status = lot.status as LotStatus
                const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started
                return (
                  <Link
                    key={lot.id}
                    href={`/sites/${siteId}/stages/${stageId}/lots/${lot.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 active:bg-stone-100 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-stone-900">
                          Lot {lot.lot_number}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                      {lot.due_date && (
                        <p className="mt-1 text-xs text-stone-500">
                          Due {formatDate(lot.due_date)}
                        </p>
                      )}
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Extra Jobs ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-stone-800">Extra jobs</h2>
            {canManageExtraJobs && (
              <Link
                href={`/sites/${siteId}/stages/${stageId}/extra-jobs/new`}
                className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900"
              >
                + Add job
              </Link>
            )}
          </div>

          {!extraJobs || extraJobs.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center">
              <p className="text-sm text-stone-500">No extra jobs yet.</p>
              {canManageExtraJobs && (
                <Link
                  href={`/sites/${siteId}/stages/${stageId}/extra-jobs/new`}
                  className="mt-3 inline-block text-sm font-medium text-green-700 hover:underline"
                >
                  Add the first extra job →
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
              {extraJobs.map((job) => {
                const jobStatus = job.status as ExtraJobStatus
                const cfg = EXTRA_JOB_STATUS_CONFIG[jobStatus] ?? EXTRA_JOB_STATUS_CONFIG.not_started
                return (
                  <Link
                    key={job.id}
                    href={`/sites/${siteId}/stages/${stageId}/extra-jobs/${job.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 active:bg-stone-100 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-stone-900">{job.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                      {job.description && (
                        <p className="mt-0.5 text-xs text-stone-500 truncate">{job.description}</p>
                      )}
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
