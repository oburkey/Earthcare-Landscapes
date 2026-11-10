'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateSiteSwms, markSiteSwmsReviewed } from './site-safety-actions'
import {
  SWMS_DETAIL_GROUPS, SWMS_DETAIL_KEYS, swmsDetailsFrom,
  type SwmsDetails, type SwmsDetailKey,
} from '@/lib/swms'
import type { CompanySafetyValues, SiteSafetyValues } from '@/lib/siteSafety'

// A site's SWMS, inside its Site safety details editor. Each SWMS has its own
// copy of the details (made when it was first assigned) — edit it for this
// job, refresh it from the current site details, or mark it reviewed.

export type SiteSwmsRow = {
  id: string
  siteId: string
  templateTitle: string
  details: SwmsDetails
  dateProvidedToPc: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  updatedAt: string
}

interface Props {
  swms: SiteSwmsRow[]
  company: CompanySafetyValues | null
  site: SiteSafetyValues | null
}

const INPUT_CLASS = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600'

const LABELS = new Map<SwmsDetailKey, string>(SWMS_DETAIL_GROUPS.flatMap(g => g.fields).map(f => [f.key, f.label]))

function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

type Mode = { kind: 'edit'; id: string } | { kind: 'refresh'; id: string } | null

export default function SiteSwmsList({ swms, company, site }: Props) {
  const router = useRouter()
  const [mode, setMode]           = useState<Mode>(null)
  const [draft, setDraft]         = useState<SwmsDetails | null>(null)
  const [dateToPc, setDateToPc]   = useState('')
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const current = swmsDetailsFrom(company, site)

  function openEdit(row: SiteSwmsRow) {
    setDraft(row.details); setDateToPc(row.dateProvidedToPc ?? ''); setError(null)
    setMode({ kind: 'edit', id: row.id })
  }

  async function save(row: SiteSwmsRow, details: SwmsDetails, date: string | null) {
    setBusy(true); setError(null)
    const result = await updateSiteSwms(row.id, details, date)
    setBusy(false)
    if (result.error) { setError(result.error); return }
    setMode(null)
    router.refresh()
  }

  async function review(row: SiteSwmsRow) {
    setBusy(true); setError(null)
    const result = await markSiteSwmsReviewed(row.id)
    setBusy(false)
    if (result.error) { setError(result.error); return }
    router.refresh()
  }

  return (
    <fieldset className="space-y-2 border-t border-border pt-4">
      <legend className="text-xs font-semibold uppercase tracking-wide text-fg-muted">SWMS for this site</legend>
      {swms.length === 0 ? (
        <p className="text-sm text-fg-muted">No SWMS yet. One is made for this site the first time a SWMS is assigned here.</p>
      ) : (
        <div className="space-y-2">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {swms.map(row => {
            const diffs = SWMS_DETAIL_KEYS.filter(k => row.details[k] !== current[k])
            const editing = mode?.kind === 'edit' && mode.id === row.id
            const refreshing = mode?.kind === 'refresh' && mode.id === row.id
            return (
              <div key={row.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{row.templateTitle}</p>
                    <p className="text-xs text-fg-muted">
                      {row.reviewedAt ? `Reviewed by ${row.reviewedByName ?? 'unknown'} · ${formatYmd(row.reviewedAt)}` : 'Not reviewed'}
                      {row.dateProvidedToPc && ` · Provided to PC ${formatYmd(row.dateProvidedToPc)}`}
                      {diffs.length > 0 && site && ` · ${diffs.length} field${diffs.length !== 1 ? 's' : ''} differ from site details`}
                    </p>
                  </div>
                  {!editing && !refreshing && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => openEdit(row)} disabled={busy}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50">
                        Edit
                      </button>
                      {site && diffs.length > 0 && (
                        <button type="button" onClick={() => { setError(null); setMode({ kind: 'refresh', id: row.id }) }} disabled={busy}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50">
                          Refresh from site details
                        </button>
                      )}
                      <button type="button" onClick={() => review(row)} disabled={busy}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50">
                        Mark reviewed
                      </button>
                    </div>
                  )}
                </div>

                {refreshing && (
                  <div className="space-y-2">
                    <p className="text-xs text-fg-muted">These fields will change to match the current company and site details:</p>
                    <div className="rounded-lg border border-border divide-y divide-border-subtle text-xs">
                      {diffs.map(k => (
                        <div key={k} className="grid grid-cols-3 gap-2 px-3 py-1.5">
                          <span className="font-medium text-fg-secondary">{LABELS.get(k) ?? k}</span>
                          <span className="text-fg-muted line-through break-words">{row.details[k] || '—'}</span>
                          <span className="text-fg break-words">{current[k] || '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => save(row, current, row.dateProvidedToPc)} disabled={busy}
                        className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50">
                        {busy ? 'Saving…' : 'Apply'}
                      </button>
                      <button type="button" onClick={() => setMode(null)} disabled={busy}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {editing && draft && (
                  <div className="space-y-4">
                    {SWMS_DETAIL_GROUPS.map(group => (
                      <div key={group.title} className="space-y-2">
                        <p className="text-xs font-semibold text-fg-muted">{group.title}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {group.fields.map(f => (
                            <label key={f.key} className={`block ${f.multiline ? 'sm:col-span-2' : ''}`}>
                              <span className="block text-xs text-fg-muted mb-1">{f.label}</span>
                              {f.multiline ? (
                                <textarea rows={2} value={draft[f.key]}
                                  onChange={e => setDraft(d => d ? { ...d, [f.key]: e.target.value } : d)}
                                  className={`${INPUT_CLASS} resize-y`} />
                              ) : (
                                <input value={draft[f.key]}
                                  onChange={e => setDraft(d => d ? { ...d, [f.key]: e.target.value } : d)}
                                  className={INPUT_CLASS} />
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <label className="block max-w-xs">
                      <span className="block text-xs text-fg-muted mb-1">Date SWMS provided to PC</span>
                      <input type="date" value={dateToPc} onChange={e => setDateToPc(e.target.value)} className={INPUT_CLASS} />
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => save(row, draft, dateToPc || null)} disabled={busy}
                        className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50">
                        {busy ? 'Saving…' : 'Save SWMS'}
                      </button>
                      <button type="button" onClick={() => setMode(null)} disabled={busy}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}
