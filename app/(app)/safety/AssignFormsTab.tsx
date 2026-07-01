'use client'

import { useState } from 'react'
import { assignForm, revokeAssignment } from './forms-actions'
import type { SafetyFormType } from '@/types/database'

export type AssignmentManagementRow = {
  id: string
  templateId: string
  templateTitle: string
  formType: SafetyFormType
  assignedTo: string
  assigneeName: string
  siteId: string | null
  siteName: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
}

export type TemplateOption = { id: string; title: string; formType: SafetyFormType; isSiteSpecific: boolean }
export type WorkerOption   = { id: string; name: string }
export type SiteOption     = { id: string; name: string }

interface Props {
  assignments: AssignmentManagementRow[]
  templates: TemplateOption[]
  workers: WorkerOption[]
  sites: SiteOption[]
  tableExists: boolean
}

export default function AssignFormsTab({ assignments: initial, templates, workers, sites, tableExists }: Props) {
  const [assignments, setAssignments] = useState<AssignmentManagementRow[]>(initial)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null)
  const [selectedWorkers, setSelectedWorkers]   = useState<Set<string>>(new Set())
  const [selectedSite, setSelectedSite]         = useState('')
  const [dueDate, setDueDate]                   = useState('')
  const [assigning, setAssigning]               = useState(false)
  const [error, setError]                       = useState<string | null>(null)
  const [revoking, setRevoking]                 = useState<string | null>(null)
  const [successMsg, setSuccessMsg]             = useState<string | null>(null)
  const [showForm, setShowForm]                 = useState(false)

  function toggleWorker(id: string) {
    setSelectedWorkers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleAssign() {
    if (!selectedTemplate) { setError('Select a form template'); return }
    if (selectedWorkers.size === 0) { setError('Select at least one worker'); return }
    if (selectedTemplate.isSiteSpecific && !selectedSite) { setError('Select a site for this site-specific form'); return }

    setAssigning(true); setError(null); setSuccessMsg(null)
    const result = await assignForm({
      template_id: selectedTemplate.id,
      worker_ids:  Array.from(selectedWorkers),
      site_id:     selectedTemplate.isSiteSpecific ? selectedSite : null,
      due_date:    dueDate || null,
    })
    setAssigning(false)

    if (result?.error && !('created' in result)) { setError(result.error); return }

    const created = result && 'created' in result ? result.created ?? [] : []
    if (created.length > 0) {
      const now = new Date().toISOString()
      const newRows: AssignmentManagementRow[] = Array.from(selectedWorkers).map(wid => {
        const worker = workers.find(w => w.id === wid)
        const site   = sites.find(s => s.id === selectedSite)
        return {
          id:            '',  // placeholder; real ids come on reload
          templateId:    selectedTemplate.id,
          templateTitle: selectedTemplate.title,
          formType:      selectedTemplate.formType,
          assignedTo:    wid,
          assigneeName:  worker?.name ?? '',
          siteId:        selectedSite || null,
          siteName:      site?.name ?? null,
          dueDate:       dueDate || null,
          completedAt:   null,
          createdAt:     now,
        }
      })
      setAssignments(prev => [...newRows, ...prev])
      setSuccessMsg(`Assigned to ${created.length} worker${created.length !== 1 ? 's' : ''}.`)
      setSelectedWorkers(new Set()); setSelectedTemplate(null); setSelectedSite(''); setDueDate('')
      setShowForm(false)
    }
    if (result && 'errors' in result && result.errors) setError(result.errors.join('; '))
  }

  async function handleRevoke(id: string) {
    setRevoking(id)
    const result = await revokeAssignment(id)
    setRevoking(null)
    if (result?.error) { setError(result.error); return }
    setAssignments(prev => prev.filter(a => a.id !== id))
  }

  if (!tableExists) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center">
        <p className="text-sm text-fg-muted">Safety forms tables not yet set up. Run the SQL migration to enable this feature.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error    && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {successMsg && <p className="rounded-lg bg-accent-dim px-3 py-2 text-sm text-accent-fg">{successMsg}</p>}

      {/* Assign form */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">Assign a form</h3>
          <button
            type="button"
            onClick={() => setShowForm(p => !p)}
            className="text-xs font-medium text-accent-fg hover:underline"
          >
            {showForm ? 'Close' : 'Open'}
          </button>
        </div>

        {showForm && (
          <div className="space-y-4">
            {/* Template */}
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Form template *</label>
              <select
                value={selectedTemplate?.id ?? ''}
                onChange={e => {
                  const t = templates.find(x => x.id === e.target.value) ?? null
                  setSelectedTemplate(t)
                  if (!t?.isSiteSpecific) setSelectedSite('')
                }}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-green-600"
              >
                <option value="">— Select template —</option>
                {templates.filter(t => t.formType !== 'reference').map(t => (
                  <option key={t.id} value={t.id}>{t.title} ({t.formType})</option>
                ))}
              </select>
            </div>

            {/* Site (conditional) */}
            {selectedTemplate?.isSiteSpecific && (
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Site *</label>
                <select
                  value={selectedSite}
                  onChange={e => setSelectedSite(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-green-600"
                >
                  <option value="">— Select site —</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Due date */}
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Due date (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>

            {/* Workers */}
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Assign to workers *</label>
              <div className="rounded-xl border border-border bg-bg max-h-48 overflow-y-auto divide-y divide-border-subtle">
                {workers.map(w => (
                  <label key={w.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-raised">
                    <input
                      type="checkbox"
                      checked={selectedWorkers.has(w.id)}
                      onChange={() => toggleWorker(w.id)}
                      className="h-4 w-4 rounded border-border text-green-700 focus:ring-green-600 focus:ring-1 focus:outline-none"
                    />
                    <span className="text-sm text-fg">{w.name}</span>
                  </label>
                ))}
              </div>
              {selectedWorkers.size > 0 && (
                <p className="mt-1 text-xs text-fg-muted">{selectedWorkers.size} selected</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleAssign}
              disabled={assigning}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {assigning ? 'Assigning…' : 'Assign form'}
            </button>
          </div>
        )}
      </div>

      {/* Existing assignments */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-fg-secondary uppercase tracking-wide">
          All assignments ({assignments.length})
        </h3>
        {assignments.length === 0 ? (
          <p className="text-sm text-fg-muted">No assignments yet.</p>
        ) : (
          <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
            {assignments.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{a.assigneeName}</p>
                  <p className="text-xs text-fg-muted">
                    {a.templateTitle}
                    {a.siteName && ` · ${a.siteName}`}
                    {a.dueDate && ` · Due ${new Date(a.dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.completedAt ? (
                    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-accent-dim text-accent-fg">
                      Completed
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                        Pending
                      </span>
                      {a.id && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(a.id)}
                          disabled={revoking === a.id}
                          className="text-xs text-fg-muted hover:text-red-600 disabled:opacity-50 transition-colors"
                        >
                          {revoking === a.id ? 'Revoking…' : 'Revoke'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
