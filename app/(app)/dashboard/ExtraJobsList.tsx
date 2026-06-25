import Link from 'next/link'
import { EXTRA_JOB_STATUS_CONFIG, siteColour, formatDate } from '@/lib/lotStatus'
import type { ExtraJobStatus } from '@/types/database'

export type ExtraJobItem = {
  id: string
  title: string
  siteName: string
  siteId: string
  stageId: string
  dueDate: string | null
  status: ExtraJobStatus
}

export default function ExtraJobsList({ jobs }: { jobs: ExtraJobItem[] }) {
  if (jobs.length === 0) return null

  return (
    <section>
      <h2 className="text-base font-semibold text-stone-800 mb-3">Extra jobs to complete</h2>
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
        {jobs.map((job) => {
          const sc = siteColour(job.siteName)
          const cfg = EXTRA_JOB_STATUS_CONFIG[job.status] ?? EXTRA_JOB_STATUS_CONFIG.not_started
          return (
            <Link
              key={job.id}
              href={`/sites/${job.siteId}/stages/${job.stageId}/extra-jobs/${job.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors"
            >
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${sc.badge}`}>
                {sc.abbr}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-900 truncate">{job.title}</p>
                {job.dueDate && (
                  <p className="text-xs text-stone-500">Due {formatDate(job.dueDate)}</p>
                )}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                {cfg.label}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
