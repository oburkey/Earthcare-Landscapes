'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignForm } from './forms-actions'
import type { SafetyFormType } from '@/types/database'

// The "Assign a form" panel at the top of Safety Admin. After assigning, the
// page refreshes so the Forms list shows the new rows with their real ids.

export type TemplateOption = { id: string; title: string; formType: SafetyFormType; isSiteSpecific: boolean }
export type WorkerOption   = { id: string; name: string }
export type SiteOption     = { id: string; name: string }

interface Props {
  templates: TemplateOption[]
  workers: WorkerOption[]
  sites: SiteOption[]
  onClose: () => void
  onAssigned: (message: string) => void
}

export default function AssignFormPanel({ templates, workers, sites, onClose, onAssigned }: Props) {
  const router = useRouter()
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null)
  const [selectedWorkers, setSelectedWorkers]   = useState<Set<string>>(new Set())
  const [selectedSite, setSelectedSite]         = useState('')
  const [dueDate, setDueDate]                   = useState('')
  const [assigning, setAssigning]               = useState(false)
  const [error, setError]                       = useState<string | null>(null)

  function toggleWorker(id: string) {
    setSelectedWorkers(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  async function handleAssign() {
    if (!selectedTemplate) { setError('Select a form template'); return }
    if (selectedWorkers.size === 0) { setError('Select at least one worker'); return }
    if (selectedTemplate.isSiteSpecific && !selectedSite) { setError('Select a site for this site-specific form'); return }

    setAssigning(true); setError(null)
    const result = await assignForm({
      template_id: selectedTemplate.id,
      worker_ids:  Array.from(selectedWorkers),
      site_id:     selectedTemplate.isSiteSpecific ? selectedSite : null,
      due_date:    dueDate || null,
    })
    setAssigning(false)

    if (result?.error && !('created' in result)) { setError(result.error); return }

    const created = result && 'created' in result ? result.created ?? [] : []
    const skipped = result && 'errors' in result && result.errors ? result.errors : []
    const warnings = result && 'warnings' in result && result.warnings ? result.warnings : []
    if (created.length > 0) {
      router.refresh()
      onAssigned(
        `Assigned to ${created.length} worker${created.length !== 1 ? 's' : ''}.` +
        (skipped.length > 0 ? ` ${skipped.length} skipped: ${skipped.join('; ')}` : '') +
        (warnings.length > 0 ? ` ${warnings.join(' ')}` : '')
      )
      onClose()
    } else if (skipped.length > 0) {
      setError(skipped.join('; '))
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">Assign a form</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-fg-muted hover:text-fg-secondary"
        >
          Close
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

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
  )
}
