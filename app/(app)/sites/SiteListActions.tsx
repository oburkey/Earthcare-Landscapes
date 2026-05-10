'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PrefetchLink } from '@/app/_components/PrefetchLink'
import { setSiteComplete, setSiteActive } from './actions'

type SiteEntry = {
  id: string
  name: string
  address: string | null
  total: number
  completed: number
  stageCount: number
}

interface Props {
  activeSites: SiteEntry[]
  completedSites: SiteEntry[]
  isAdmin: boolean
}

export default function SiteListActions({ activeSites, completedSites, isAdmin }: Props) {
  const router = useRouter()
  const [showCompleted, setShowCompleted] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleComplete(siteId: string) {
    setActionError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('site_id', siteId)
      const result = await setSiteComplete(null, fd)
      if (result?.error) {
        setActionError(result.error)
      } else {
        setConfirmId(null)
        router.refresh()
      }
    })
  }

  function handleActivate(siteId: string) {
    setActionError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('site_id', siteId)
      const result = await setSiteActive(null, fd)
      if (result?.error) {
        setActionError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  if (activeSites.length === 0 && completedSites.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-12 text-center">
        <p className="text-sm text-stone-500">No sites yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Active sites */}
      {activeSites.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center">
          <p className="text-sm text-stone-500">No active sites.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
          {activeSites.map((site) => {
            const pct = site.total > 0 ? Math.round((site.completed / site.total) * 100) : 0
            const isConfirming = confirmId === site.id

            return (
              <div key={site.id} className="flex items-center gap-3 px-4 py-4 hover:bg-stone-50 transition-colors">

                {/* Navigable area */}
                <PrefetchLink href={`/sites/${site.id}`} className="min-w-0 flex-1 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-900 truncate">{site.name}</p>
                    {site.address && (
                      <p className="mt-0.5 text-xs text-stone-500 truncate">{site.address}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-stone-500">
                        {site.stageCount} stage{site.stageCount !== 1 ? 's' : ''}
                      </span>
                      {site.total > 0 && (
                        <>
                          <span className="text-stone-300">·</span>
                          <span className="text-xs text-stone-500">{site.completed}/{site.total} lots</span>
                          <div className="flex-1 max-w-24 h-1.5 rounded-full bg-stone-100">
                            <div className="h-1.5 rounded-full bg-green-600" style={{ width: `${pct}%` }} />
                          </div>
                        </>
                      )}
                    </div>
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
                        onClick={() => { setConfirmId(site.id); setActionError(null) }}
                        className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50 transition-colors"
                      >
                        Mark complete
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-600 hidden sm:inline">Complete?</span>
                        <button
                          type="button"
                          onClick={() => handleComplete(site.id)}
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

      {/* Completed sites toggle */}
      {completedSites.length > 0 && (
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
            {showCompleted ? 'Hide' : 'Show'} completed sites ({completedSites.length})
          </button>

          {showCompleted && (
            <div className="mt-3 rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
              {completedSites.map((site) => {
                const pct = site.total > 0 ? Math.round((site.completed / site.total) * 100) : 0
                return (
                  <div key={site.id} className="flex items-center gap-3 px-4 py-4 hover:bg-stone-50 transition-colors">

                    <PrefetchLink href={`/sites/${site.id}`} className="min-w-0 flex-1 flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-stone-500 truncate">{site.name}</p>
                          <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-400">
                            Complete
                          </span>
                        </div>
                        {site.address && (
                          <p className="mt-0.5 text-xs text-stone-400 truncate">{site.address}</p>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-xs text-stone-400">
                            {site.stageCount} stage{site.stageCount !== 1 ? 's' : ''}
                          </span>
                          {site.total > 0 && (
                            <>
                              <span className="text-stone-300">·</span>
                              <span className="text-xs text-stone-400">{site.completed}/{site.total} lots</span>
                              <div className="flex-1 max-w-24 h-1.5 rounded-full bg-stone-100">
                                <div className="h-1.5 rounded-full bg-stone-400" style={{ width: `${pct}%` }} />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <svg className="h-4 w-4 shrink-0 text-stone-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </PrefetchLink>

                    {/* Admin: mark active */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleActivate(site.id)}
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
