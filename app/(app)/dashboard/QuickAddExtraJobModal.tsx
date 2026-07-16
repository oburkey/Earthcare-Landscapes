'use client'

import { useState, useActionState } from 'react'
import { createExtraJob } from '@/app/(app)/sites/[siteId]/stages/[stageId]/extra-jobs/new/actions'
import { EXTRA_JOB_STATUS_OPTIONS } from '@/lib/lotStatus'
import type { ActionState } from '@/types/actions'

interface Stage { id: string; name: string }
interface Site  { id: string; name: string; stages: Stage[] }

export default function QuickAddExtraJobModal({ sites }: { sites: Site[] }) {
  const [open, setOpen]               = useState(false)
  const [selectedSiteId, setSiteId]   = useState('')
  const [selectedStageId, setStageId] = useState('')
  const [state, action, pending]      = useActionState<ActionState, FormData>(createExtraJob, null)

  const selectedSite = sites.find((s) => s.id === selectedSiteId)
  const stages       = selectedSite?.stages ?? []

  function handleSiteChange(siteId: string) {
    setSiteId(siteId)
    const stgs = sites.find((s) => s.id === siteId)?.stages ?? []
    setStageId(stgs.length === 1 ? stgs[0].id : '')
  }

  function handleClose() {
    setOpen(false)
    setSiteId('')
    setStageId('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900 transition-colors"
      >
        + New Extra Job
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

          {/* Modal card */}
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-fg">New Extra Job</h2>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-raised hover:text-fg transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form action={action} className="p-5 space-y-4">
              {/* Hidden fields carry the selected IDs into the server action */}
              <input type="hidden" name="site_id"  value={selectedSiteId} />
              <input type="hidden" name="stage_id" value={selectedStageId} />

              {/* Site + Stage — two columns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="qaj-site" className="block text-sm font-medium text-fg-secondary">
                    Site <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="qaj-site"
                    value={selectedSiteId}
                    onChange={(e) => handleSiteChange(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                  >
                    <option value="">Select…</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="qaj-stage" className="block text-sm font-medium text-fg-secondary">
                    Stage <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="qaj-stage"
                    value={selectedStageId}
                    onChange={(e) => setStageId(e.target.value)}
                    disabled={!selectedSiteId || stages.length === 0}
                    className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!selectedSiteId ? 'Pick a site first' : stages.length === 0 ? 'No stages' : 'Select…'}
                    </option>
                    {stages.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label htmlFor="qaj-title" className="block text-sm font-medium text-fg-secondary">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="qaj-title"
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Clean up drainage channel"
                  className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                />
              </div>

              {/* Status + Due date — two columns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="qaj-status" className="block text-sm font-medium text-fg-secondary">
                    Status
                  </label>
                  <select
                    id="qaj-status"
                    name="status"
                    defaultValue="not_started"
                    className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                  >
                    {EXTRA_JOB_STATUS_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="qaj-due" className="block text-sm font-medium text-fg-secondary">
                    Due date
                  </label>
                  <input
                    id="qaj-due"
                    name="due_date"
                    type="date"
                    className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="qaj-desc" className="block text-sm font-medium text-fg-secondary">
                  Description
                </label>
                <textarea
                  id="qaj-desc"
                  name="description"
                  rows={2}
                  placeholder="Brief description of the work…"
                  className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
                />
              </div>

              {state?.error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={pending || !selectedSiteId || !selectedStageId}
                  className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {pending ? 'Saving…' : 'Add extra job'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-sm text-fg-muted hover:text-fg-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </>
  )
}
