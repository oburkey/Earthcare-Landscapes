'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { EXTRA_JOB_STATUS_CONFIG, siteColour, formatDate, DELAYED_BADGE_CLASS, delayedBadgeLabel } from '@/lib/lotStatus'
import { markExtraJobComplete } from '@/app/(app)/sites/[siteId]/stages/[stageId]/extra-jobs/[extraJobId]/actions'
import type { ExtraJobStatus } from '@/types/database'

export type ExtraJobItem = {
  id: string
  title: string
  siteName: string
  siteId: string
  stageId: string
  dueDate: string | null
  status: ExtraJobStatus
  delayed: boolean
  delayReason: string | null
  expectedCompletionDate: string | null
}

export default function ExtraJobsList({ jobs: initialJobs, canManage }: { jobs: ExtraJobItem[]; canManage: boolean }) {
  const [jobs, setJobs] = useState(initialJobs)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (jobs.length === 0) return null

  // Optimistic — the row disappears immediately; on failure it's re-inserted
  // and the error surfaces above the list. No confirmation dialog since this
  // is meant to be a quick tap.
  function handleComplete(job: ExtraJobItem) {
    setError(null)
    setJobs((prev) => prev.filter((j) => j.id !== job.id))
    startTransition(async () => {
      const result = await markExtraJobComplete(job.id, job.siteId, job.stageId)
      if (result?.error) {
        setError(result.error)
        setJobs((prev) =>
          [...prev, job].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
        )
      }
    })
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-fg-secondary mb-3">Extra jobs to complete</h2>
      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
        {jobs.map((job) => {
          const sc = siteColour(job.siteName)
          const cfg = EXTRA_JOB_STATUS_CONFIG[job.status] ?? EXTRA_JOB_STATUS_CONFIG.not_started
          return (
            <div key={job.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-raised transition-colors">
              <Link
                href={`/sites/${job.siteId}/stages/${job.stageId}/extra-jobs/${job.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${sc.badge}`}>
                  {sc.abbr}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg truncate">{job.title}</p>
                  {job.dueDate && (
                    <p className="text-xs text-fg-muted">Due {formatDate(job.dueDate)}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                  {cfg.label}
                </span>
                {job.delayed && (
                  <span
                    title={job.delayReason ?? undefined}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DELAYED_BADGE_CLASS}`}
                  >
                    {delayedBadgeLabel(job.expectedCompletionDate)}
                  </span>
                )}
              </Link>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleComplete(job)}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-fg-muted hover:border-green-200 hover:bg-accent-dim hover:text-accent-fg transition-colors"
                >
                  Mark complete
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
