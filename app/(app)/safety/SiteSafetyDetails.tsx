'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/app/_components/Modal'
import { saveCompanyDetails, saveSiteSafetyDetails, markSiteReviewed } from './site-safety-actions'
import {
  COMPANY_FIELDS, SITE_SAFETY_GROUPS, SITE_SAFETY_KEYS, SITE_ONLY_KEYS,
  emptySiteSafetyValues, filledCount, isReviewOverdue,
  type CompanySafetyValues, type SiteSafetyValues,
} from '@/lib/siteSafety'

// Safety Admin → Site safety details. One place to keep each site's safety
// details (they fill every SWMS and the site induction). Supervisor+ edit
// sites; only admins edit the company details.

export type SiteSafetyRow = {
  siteId: string
  siteName: string
  details: SiteSafetyValues | null   // null = never saved
  lastReviewedAt: string | null
  lastReviewedByName: string | null
}

interface Props {
  isAdmin: boolean
  todayPerth: string
  company: CompanySafetyValues | null
  sites: SiteSafetyRow[]
  // Extra content in a site's editor (its SWMS list)
  renderSiteExtras?: (siteId: string) => ReactNode
}

const INPUT_CLASS = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600'

function reviewedLine(row: SiteSafetyRow): string {
  if (!row.lastReviewedAt) return 'Never reviewed'
  const date = new Date(row.lastReviewedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Perth' })
  return row.lastReviewedByName ? `Last reviewed by ${row.lastReviewedByName} · ${date}` : `Last reviewed ${date}`
}

export default function SiteSafetyDetails({ isAdmin, todayPerth, company, sites, renderSiteExtras }: Props) {
  const router = useRouter()
  const [editingCompany, setEditingCompany] = useState(false)
  const [companyDraft, setCompanyDraft]     = useState<CompanySafetyValues | null>(null)
  const [editingSite, setEditingSite]       = useState<SiteSafetyRow | null>(null)
  const [draft, setDraft]                   = useState<SiteSafetyValues>(emptySiteSafetyValues())
  const [copyFrom, setCopyFrom]             = useState('')
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  const total = SITE_SAFETY_KEYS.length
  const sorted = [...sites].sort((a, b) =>
    Number(isReviewOverdue(b.lastReviewedAt, todayPerth)) - Number(isReviewOverdue(a.lastReviewedAt, todayPerth))
    || a.siteName.localeCompare(b.siteName))

  function openSite(row: SiteSafetyRow) {
    setDraft(row.details ?? emptySiteSafetyValues())
    setCopyFrom(''); setError(null)
    setEditingSite(row)
  }

  // Fills the form from another site without saving — check it, then Save
  function applyCopy(fromSiteId: string) {
    setCopyFrom(fromSiteId)
    const source = sites.find(s => s.siteId === fromSiteId)?.details
    if (!source) return
    setDraft(prev => {
      const next = { ...prev }
      for (const k of SITE_SAFETY_KEYS) if (!SITE_ONLY_KEYS.includes(k)) next[k] = source[k]
      return next
    })
  }

  async function handleSaveSite() {
    if (!editingSite) return
    setSaving(true); setError(null)
    const result = await saveSiteSafetyDetails(editingSite.siteId, draft)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setEditingSite(null)
    router.refresh()
  }

  async function handleMarkReviewed() {
    if (!editingSite) return
    setSaving(true); setError(null)
    const result = await markSiteReviewed(editingSite.siteId)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setEditingSite(null)
    router.refresh()
  }

  async function handleSaveCompany() {
    if (!companyDraft) return
    setSaving(true); setError(null)
    const result = await saveCompanyDetails(companyDraft)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setEditingCompany(false)
    router.refresh()
  }

  const copySources = sites.filter(s => s.details && s.siteId !== editingSite?.siteId)

  return (
    <div className="space-y-4">
      {/* Company details */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-fg">Company details</h3>
          {isAdmin && company && !editingCompany && (
            <button
              type="button"
              onClick={() => { setCompanyDraft(company); setError(null); setEditingCompany(true) }}
              className="text-xs font-medium text-accent-fg hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        {!company ? (
          <p className="text-sm text-fg-muted">Company details aren&apos;t set up yet.</p>
        ) : editingCompany && companyDraft ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {COMPANY_FIELDS.map(f => (
                <label key={f.key} className="block">
                  <span className="block text-xs font-medium text-fg-muted mb-1">{f.label}</span>
                  <input
                    value={companyDraft[f.key]}
                    onChange={e => setCompanyDraft(d => d ? { ...d, [f.key]: e.target.value } : d)}
                    className={INPUT_CLASS}
                  />
                </label>
              ))}
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveCompany}
                disabled={saving}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setEditingCompany(false); setError(null) }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-sm">
            {COMPANY_FIELDS.map(f => (
              <div key={f.key} className="flex gap-2 min-w-0">
                <dt className="text-fg-muted shrink-0">{f.label}:</dt>
                <dd className={`truncate ${company[f.key] ? 'text-fg' : 'text-red-600'}`}>{company[f.key] || 'Missing'}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Sites */}
      {sorted.length === 0 ? (
        <p className="text-sm text-fg-muted">No active sites.</p>
      ) : (
        <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
          {sorted.map(row => {
            const filled = filledCount(row.details)
            const overdue = isReviewOverdue(row.lastReviewedAt, todayPerth)
            return (
              <button
                key={row.siteId}
                type="button"
                onClick={() => openSite(row)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-raised transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{row.siteName}</p>
                  <p className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-fg-muted'}`}>
                    {reviewedLine(row)}{overdue && row.lastReviewedAt ? ' · review overdue' : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                  !row.details ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : filled === total ? 'bg-accent-dim text-accent-fg'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                }`}>
                  {!row.details ? 'Missing' : filled === total ? 'Filled' : `${filled} of ${total} filled`}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Site editor */}
      {editingSite && (
        <Modal
          title={`Safety details — ${editingSite.siteName}`}
          width="3xl"
          onClose={() => setEditingSite(null)}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-fg-muted">{reviewedLine(editingSite)}</p>
              <div className="flex flex-wrap gap-2">
                {editingSite.details && (
                  <button
                    type="button"
                    onClick={handleMarkReviewed}
                    disabled={saving}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50"
                  >
                    Mark reviewed, no changes
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveSite}
                  disabled={saving}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {copySources.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-fg-secondary">Copy from another site</label>
                <select
                  value={copyFrom}
                  onChange={e => applyCopy(e.target.value)}
                  className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-green-600"
                >
                  <option value="">— Choose a site —</option>
                  {copySources.map(s => <option key={s.siteId} value={s.siteId}>{s.siteName}</option>)}
                </select>
                {copyFrom && (
                  <span className="text-xs text-fg-muted">Copied (except project name and address). Check it, then Save.</span>
                )}
              </div>
            )}

            {SITE_SAFETY_GROUPS.map(group => (
              <fieldset key={group.title} className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{group.title}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.fields.map(f => (
                    <label key={f.key} className={`block ${f.multiline ? 'sm:col-span-2' : ''}`}>
                      <span className="block text-xs font-medium text-fg-muted mb-1">{f.label}</span>
                      {f.multiline ? (
                        <textarea
                          rows={3}
                          value={draft[f.key]}
                          onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                          className={`${INPUT_CLASS} resize-y`}
                        />
                      ) : (
                        <input
                          value={draft[f.key]}
                          onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                          className={INPUT_CLASS}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            {renderSiteExtras?.(editingSite.siteId)}
          </div>
        </Modal>
      )}
    </div>
  )
}
