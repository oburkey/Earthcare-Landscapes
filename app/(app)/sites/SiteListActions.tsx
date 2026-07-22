'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setSiteComplete, setSiteActive } from './actions'
import { siteColour, formatDate } from '@/lib/lotStatus'

const EXPANDED_STORAGE_KEY = 'sites-expanded'

type StageEntry = {
  id: string
  name: string
  lotCount: number
  activeLotCount: number
}

type SiteEntry = {
  id: string
  name: string
  address: string | null
  total: number
  completed: number
  stageCount: number
  activeLotCount: number
  nextDueDate: string | null
  stages: StageEntry[]
}

interface Props {
  activeSites: SiteEntry[]
  completedSites: SiteEntry[]
  isAdmin: boolean
}

function loadExpanded(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function SiteCard({
  site, isAdmin, isCompleted, expanded, onToggle, confirmId, setConfirmId, isPending, onComplete, onActivate,
}: {
  site: SiteEntry
  isAdmin: boolean
  isCompleted: boolean
  expanded: boolean
  onToggle: () => void
  confirmId: string | null
  setConfirmId: (id: string | null) => void
  isPending: boolean
  onComplete: (id: string) => void
  onActivate: (id: string) => void
}) {
  const pct = site.total > 0 ? Math.round((site.completed / site.total) * 100) : 0
  const { abbr, badge } = siteColour(site.name)
  const isConfirming = confirmId === site.id

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-4 hover:bg-surface-raised transition-colors">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 flex items-center gap-3 text-left"
        >
          <svg className={`h-4 w-4 shrink-0 text-fg-muted transition-transform ${expanded ? '' : '-rotate-90'}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>{abbr}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold truncate ${isCompleted ? 'text-fg-muted' : 'text-fg'}`}>{site.name}</p>
              {isCompleted && (
                <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-fg-muted">Complete</span>
              )}
            </div>
            {site.address && (
              <p className="mt-0.5 text-xs text-fg-muted truncate">{site.address}</p>
            )}
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <span className="text-xs text-fg-muted">
                {site.stageCount} stage{site.stageCount !== 1 ? 's' : ''}
              </span>
              {site.total > 0 && (
                <>
                  <span className="text-fg-muted">·</span>
                  <span className="text-xs text-fg-muted">{site.activeLotCount} active lot{site.activeLotCount !== 1 ? 's' : ''}</span>
                  <div className="flex-1 max-w-24 h-1.5 rounded-full bg-surface-raised">
                    <div className={`h-1.5 rounded-full ${isCompleted ? 'bg-stone-400' : 'bg-green-600'}`} style={{ width: `${pct}%` }} />
                  </div>
                </>
              )}
              {site.nextDueDate && (
                <>
                  <span className="text-fg-muted">·</span>
                  <span className="text-xs text-fg-muted">Next due {formatDate(site.nextDueDate)}</span>
                </>
              )}
            </div>
          </div>
        </button>

        <Link
          href={`/sites/${site.id}`}
          title="View full site page"
          className="shrink-0 text-fg-muted hover:text-fg-secondary transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>

        {isAdmin && !isCompleted && (
          <div className="shrink-0">
            {!isConfirming ? (
              <button
                type="button"
                onClick={() => setConfirmId(site.id)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-raised transition-colors"
              >
                Mark complete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-fg-secondary hidden sm:inline">Complete?</span>
                <button
                  type="button"
                  onClick={() => onComplete(site.id)}
                  disabled={isPending}
                  className="rounded-lg bg-green-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
                >
                  {isPending ? '…' : 'Yes'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(null)}
                  disabled={isPending}
                  className="text-xs text-fg-muted hover:text-fg-secondary"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {isAdmin && isCompleted && (
          <button
            type="button"
            onClick={() => onActivate(site.id)}
            disabled={isPending}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-raised disabled:opacity-50 transition-colors"
          >
            Mark active
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-border-subtle divide-y divide-border-subtle">
          {site.stages.length === 0 ? (
            <p className="px-4 py-3 text-sm text-fg-muted">No stages yet.</p>
          ) : (
            site.stages.map((stage) => (
              <Link
                key={stage.id}
                href={`/sites/${site.id}/stages/${stage.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 pl-11 hover:bg-surface-raised transition-colors"
              >
                <span className="text-sm text-fg-secondary">{stage.name}</span>
                <span className="text-xs text-fg-muted shrink-0">
                  {stage.lotCount} lot{stage.lotCount !== 1 ? 's' : ''}
                  {stage.activeLotCount > 0 && ` · ${stage.activeLotCount} active`}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function SiteListActions({ activeSites, completedSites, isAdmin }: Props) {
  const router = useRouter()
  const [showCompleted, setShowCompleted] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded())

  useEffect(() => {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...expanded]))
  }, [expanded])

  function toggleExpanded(siteId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(siteId)) next.delete(siteId); else next.add(siteId)
      return next
    })
  }

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
      <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
        <p className="text-sm text-fg-muted">No sites yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Active sites */}
      {activeSites.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-8 text-center">
          <p className="text-sm text-fg-muted">No active sites.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeSites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              isAdmin={isAdmin}
              isCompleted={false}
              expanded={expanded.has(site.id)}
              onToggle={() => toggleExpanded(site.id)}
              confirmId={confirmId}
              setConfirmId={setConfirmId}
              isPending={isPending}
              onComplete={handleComplete}
              onActivate={handleActivate}
            />
          ))}
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
            className="flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg-secondary transition-colors"
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
            <div className="mt-3 space-y-2">
              {completedSites.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  isAdmin={isAdmin}
                  isCompleted={true}
                  expanded={expanded.has(site.id)}
                  onToggle={() => toggleExpanded(site.id)}
                  confirmId={confirmId}
                  setConfirmId={setConfirmId}
                  isPending={isPending}
                  onComplete={handleComplete}
                  onActivate={handleActivate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
