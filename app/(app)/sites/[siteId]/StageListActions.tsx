'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PrefetchLink } from '@/app/_components/PrefetchLink'
import { setStageComplete, setStageActive } from './actions'

type StageEntry = {
  id: string
  name: string
  total: number
  completed: number
  inProgress: number
  scheduled: number
}

interface Props {
  siteId: string
  activeStages: StageEntry[]
  completedStages: StageEntry[]
  isAdmin: boolean
  canManage: boolean
}

export default function StageListActions({
  siteId, activeStages, completedStages, isAdmin, canManage,
}: Props) {
  const router = useRouter()
  const [showCompleted, setShowCompleted] = useState(false)
  const [confirmId, setConfirmId]         = useState<string | null>(null)
  const [actionError, setActionError]     = useState<string | null>(null)
  const [isPending, startTransition]      = useTransition()

  function handleComplete(stageId: string) {
    setActionError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('site_id', siteId)
      fd.set('stage_id', stageId)
      const result = await setStageComplete(null, fd)
      if (result?.error) {
        setActionError(result.error)
      } else {
        setConfirmId(null)
        router.refresh()
      }
    })
  }

  function handleActivate(stageId: string) {
    setActionError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('site_id', siteId)
      fd.set('stage_id', stageId)
      const result = await setStageActive(null, fd)
      if (result?.error) {
        setActionError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  if (activeStages.length === 0 && completedStages.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center">
        <p className="text-sm text-stone-500">No stages yet.</p>
        {canManage && (
          <Link
            href={`/sites/${siteId}/new-stage`}
            className="mt-3 inline-block text-sm font-medium text-green-700 hover:underline"
          >
            Add the first stage →
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Active stages */}
      {activeStages.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center">
          <p className="text-sm text-stone-500">No active stages.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
          {activeStages.map((stage) => {
            const pct          = stage.total > 0 ? Math.round((stage.completed / stage.total) * 100) : 0
            const isConfirming = confirmId === stage.id
            const notStarted   = stage.total - stage.completed - stage.inProgress - stage.scheduled

            return (
              <div key={stage.id} className="flex items-center gap-4 px-4 py-4 hover:bg-stone-50 transition-colors">

                {/* Navigable area */}
                <PrefetchLink href={`/sites/${siteId}/stages/${stage.id}`} className="min-w-0 flex-1 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-900">{stage.name}</p>

                    {stage.total > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {stage.completed > 0 && <StatusPill label={`${stage.completed} complete`} color="green" />}
                        {stage.inProgress > 0 && <StatusPill label={`${stage.inProgress} in progress`} color="amber" />}
                        {stage.scheduled   > 0 && <StatusPill label={`${stage.scheduled} scheduled`} color="blue" />}
                        {notStarted        > 0 && <StatusPill label={`${notStarted} not started`} color="stone" />}
                      </div>
                    )}

                    {stage.total > 0 && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-stone-100">
                          <div className="h-1.5 rounded-full bg-green-600" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-stone-400 shrink-0">{pct}%</span>
                      </div>
                    )}

                    {stage.total === 0 && (
                      <p className="mt-0.5 text-xs text-stone-400">No lots yet</p>
                    )}
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </PrefetchLink>

                {/* Admin: mark complete */}
                {isAdmin && (
                  <div className="shrink-0">
                    {!isConfirming ? (
                      <button
                        type="button"
                        onClick={() => { setConfirmId(stage.id); setActionError(null) }}
                        className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50 transition-colors"
                      >
                        Mark complete
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-600 hidden sm:inline">Complete?</span>
                        <button
                          type="button"
                          onClick={() => handleComplete(stage.id)}
                          disabled={isPending}
                          className="rounded-lg bg-green-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
                        >
                          {isPending ? '…' : 'Yes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          disabled={isPending}
                          className="text-xs text-stone-400 hover:text-stone-600"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}

      {/* Completed stages toggle */}
      {completedStages.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform ${showCompleted ? '' : '-rotate-90'}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
            {showCompleted ? 'Hide' : 'Show'} completed stages ({completedStages.length})
          </button>

          {showCompleted && (
            <div className="mt-3 rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
              {completedStages.map((stage) => {
                const pct = stage.total > 0 ? Math.round((stage.completed / stage.total) * 100) : 0
                return (
                  <div key={stage.id} className="flex items-center gap-4 px-4 py-4 hover:bg-stone-50 transition-colors">

                    <PrefetchLink href={`/sites/${siteId}/stages/${stage.id}`} className="min-w-0 flex-1 flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-stone-500 truncate">{stage.name}</p>
                          <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-400">
                            Complete
                          </span>
                        </div>
                        {stage.total > 0 && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-stone-100">
                              <div className="h-1.5 rounded-full bg-stone-400" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-stone-400 shrink-0">{pct}%</span>
                          </div>
                        )}
                        {stage.total === 0 && (
                          <p className="mt-0.5 text-xs text-stone-400">No lots</p>
                        )}
                      </div>
                      <svg className="h-4 w-4 shrink-0 text-stone-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </PrefetchLink>

                    {/* Admin: mark active */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleActivate(stage.id)}
                        disabled={isPending}
                        className="shrink-0 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50 disabled:opacity-50 transition-colors"
                      >
                        Mark active
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusPill({ label, color }: { label: string; color: 'green' | 'blue' | 'amber' | 'stone' }) {
  const styles = {
    green: 'bg-green-100 text-green-700',
    blue:  'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    stone: 'bg-stone-100 text-stone-500',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[color]}`}>
      {label}
    </span>
  )
}
