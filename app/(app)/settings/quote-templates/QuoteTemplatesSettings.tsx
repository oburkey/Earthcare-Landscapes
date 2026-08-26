'use client'

import { useState, useTransition } from 'react'
import { createTemplate, deleteTemplate, saveTemplate } from './actions'

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateItem = {
  description: string
  qty: number
  unit: string
  rate: number
  orderIndex: number
}

type TemplateSection = {
  name: string
  orderIndex: number
  items: TemplateItem[]
}

export type TemplateRow = {
  id: string
  name: string
  description: string | null
  orderIndex: number
  sections: TemplateSection[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function reindex<T extends { orderIndex: number }>(arr: T[]): T[] {
  return arr.map((item, i) => ({ ...item, orderIndex: i }))
}

function swapAndReindex<T extends { orderIndex: number }>(arr: T[], i: number, j: number): T[] {
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return reindex(next)
}

function emptyItem(orderIndex: number): TemplateItem {
  return { description: '', qty: 1, unit: '', rate: 0, orderIndex }
}

function emptySection(orderIndex: number): TemplateSection {
  return { name: '', orderIndex, items: [emptyItem(0)] }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuoteTemplatesSettings({ templates: initialTemplates }: { templates: TemplateRow[] }) {
  const [templates, setTemplates]   = useState<TemplateRow[]>(initialTemplates)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [addingNew, setAddingNew]     = useState(false)
  const [newName, setNewName]         = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creating, startCreating]     = useTransition()
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit state for whichever template is currently expanded
  const [editName, setEditName]             = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSections, setEditSections]     = useState<TemplateSection[]>([])
  const [saving, startSaving]               = useTransition()
  const [saveError, setSaveError]           = useState<string | null>(null)

  const [, startDeleting] = useTransition()
  const [deletePending, setDeletePending] = useState<string | null>(null)

  function toggleExpand(t: TemplateRow) {
    if (expandedId === t.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(t.id)
    setEditName(t.name)
    setEditDescription(t.description ?? '')
    setEditSections(t.sections.length > 0 ? t.sections : [emptySection(0)])
    setSaveError(null)
  }

  // ── Section / item editing ───────────────────────────────────────────────

  function addSection() {
    setEditSections((prev) => reindex([...prev, emptySection(0)]))
  }

  function removeSection(idx: number) {
    setEditSections((prev) => {
      if (prev.length <= 1) return prev
      if (!confirm('Remove this section and its line items?')) return prev
      return reindex(prev.filter((_, i) => i !== idx))
    })
  }

  function renameSection(idx: number, name: string) {
    setEditSections((prev) => prev.map((s, i) => (i === idx ? { ...s, name } : s)))
  }

  function moveSection(idx: number, direction: -1 | 1) {
    const target = idx + direction
    if (target < 0 || target >= editSections.length) return
    setEditSections((prev) => swapAndReindex(prev, idx, target))
  }

  function addItem(sIdx: number) {
    setEditSections((prev) => prev.map((s, i) =>
      i === sIdx ? { ...s, items: reindex([...s.items, emptyItem(0)]) } : s
    ))
  }

  function removeItem(sIdx: number, iIdx: number) {
    setEditSections((prev) => prev.map((s, i) => {
      if (i !== sIdx || s.items.length <= 1) return s
      return { ...s, items: reindex(s.items.filter((_, j) => j !== iIdx)) }
    }))
  }

  function moveItem(sIdx: number, iIdx: number, direction: -1 | 1) {
    setEditSections((prev) => {
      const section = prev[sIdx]
      const target = iIdx + direction
      if (target < 0 || target >= section.items.length) return prev
      const reordered = swapAndReindex(section.items, iIdx, target)
      return prev.map((s, i) => (i === sIdx ? { ...s, items: reordered } : s))
    })
  }

  function updateItem<K extends keyof TemplateItem>(sIdx: number, iIdx: number, key: K, value: TemplateItem[K]) {
    setEditSections((prev) => prev.map((s, i) => {
      if (i !== sIdx) return s
      return { ...s, items: s.items.map((it, j) => (j === iIdx ? { ...it, [key]: value } : it)) }
    }))
  }

  // ── Create / Save / Delete ───────────────────────────────────────────────

  function handleCreate() {
    if (!newName.trim()) { setCreateError('Template name is required.'); return }
    setCreateError(null)

    const fd = new FormData()
    fd.set('name', newName.trim())
    fd.set('description', newDescription.trim())

    startCreating(async () => {
      const result = await createTemplate(fd)
      if ('error' in result) { setCreateError(result.error); return }

      const created: TemplateRow = {
        id: result.id,
        name: newName.trim(),
        description: newDescription.trim() || null,
        orderIndex: templates.length,
        sections: [],
      }
      setTemplates((prev) => [...prev, created])
      setNewName(''); setNewDescription(''); setAddingNew(false)
      setExpandedId(created.id)
      setEditName(created.name)
      setEditDescription(created.description ?? '')
      setEditSections([emptySection(0)])
    })
  }

  function handleSave(templateId: string) {
    if (!editName.trim()) { setSaveError('Template name is required.'); return }
    setSaveError(null)

    const fd = new FormData()
    fd.set('id', templateId)
    fd.set('name', editName.trim())
    fd.set('description', editDescription.trim())
    fd.set('sections', JSON.stringify(editSections))

    startSaving(async () => {
      const result = await saveTemplate(fd)
      if (result?.error) { setSaveError(result.error); return }
      setTemplates((prev) => prev.map((t) =>
        t.id === templateId
          ? { ...t, name: editName.trim(), description: editDescription.trim() || null, sections: editSections }
          : t
      ))
    })
  }

  function handleDelete(templateId: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    setDeletePending(templateId)
    const fd = new FormData()
    fd.set('id', templateId)
    startDeleting(async () => {
      const result = await deleteTemplate(fd)
      setDeletePending(null)
      if (result?.error) { alert(result.error); return }
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
      if (expandedId === templateId) setExpandedId(null)
    })
  }

  return (
    <div className="space-y-4">
      {templates.length === 0 && !addingNew && (
        <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
          <p className="text-sm text-fg-muted">No templates yet.</p>
        </div>
      )}

      {templates.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
          {templates.map((t) => {
            const expanded = expandedId === t.id
            return (
              <div key={t.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(t)}
                    className="flex flex-1 items-center gap-3 text-left min-w-0"
                  >
                    <svg
                      className={`h-4 w-4 text-fg-muted shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`}
                      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-fg">{t.name}</span>
                      {t.description && <p className="text-xs text-fg-muted truncate">{t.description}</p>}
                    </div>
                    <span className="ml-auto text-xs text-fg-muted shrink-0">
                      {t.sections.length} section{t.sections.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    disabled={deletePending === t.id}
                    className="shrink-0 text-fg-muted hover:text-red-500 disabled:opacity-50 transition-colors"
                  >
                    {deletePending === t.id ? (
                      <span className="text-xs">…</span>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>

                {expanded && (
                  <div className="px-4 pb-4 space-y-4 bg-surface-raised border-t border-border-subtle">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-border focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Description</label>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Optional"
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {editSections.map((section, sIdx) => (
                        <div key={sIdx} className="rounded-lg border border-border-subtle overflow-hidden bg-surface">
                          <div className="flex items-center gap-2 bg-surface-raised px-3 py-2">
                            <input
                              type="text"
                              value={section.name}
                              onChange={(e) => renameSection(sIdx, e.target.value)}
                              placeholder="Section name"
                              className="flex-1 rounded border border-border bg-surface px-2 py-1 text-sm font-medium text-fg placeholder:text-fg-muted focus:border-border focus:outline-none"
                            />
                            <MoveButtons
                              onUp={() => moveSection(sIdx, -1)}
                              onDown={() => moveSection(sIdx, 1)}
                              disabledUp={sIdx === 0}
                              disabledDown={sIdx === editSections.length - 1}
                            />
                            <button
                              type="button"
                              onClick={() => removeSection(sIdx)}
                              disabled={editSections.length === 1}
                              className="shrink-0 text-fg-muted hover:text-red-500 disabled:opacity-40 disabled:hover:text-fg-muted transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          <div className="p-3 space-y-2">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-left text-xs font-semibold text-fg-secondary uppercase tracking-wide pb-2 pr-3 min-w-[160px]">Description</th>
                                    <th className="text-right text-xs font-semibold text-fg-secondary uppercase tracking-wide pb-2 px-2 w-16">Qty</th>
                                    <th className="text-left text-xs font-semibold text-fg-secondary uppercase tracking-wide pb-2 px-2 w-20">Unit</th>
                                    <th className="text-right text-xs font-semibold text-fg-secondary uppercase tracking-wide pb-2 px-2 w-24">Rate</th>
                                    <th className="pb-2 w-16"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.items.map((item, iIdx) => (
                                    <tr key={iIdx} className="border-b border-border-subtle">
                                      <td className="py-1.5 pr-3">
                                        <input
                                          type="text"
                                          value={item.description}
                                          onChange={(e) => updateItem(sIdx, iIdx, 'description', e.target.value)}
                                          placeholder="Description"
                                          className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none"
                                        />
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <input
                                          type="number"
                                          min={0}
                                          step="any"
                                          value={item.qty}
                                          onChange={(e) => updateItem(sIdx, iIdx, 'qty', parseFloat(e.target.value) || 0)}
                                          className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg text-right focus:border-border focus:outline-none"
                                        />
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <input
                                          type="text"
                                          value={item.unit}
                                          onChange={(e) => updateItem(sIdx, iIdx, 'unit', e.target.value)}
                                          placeholder="unit"
                                          className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none"
                                        />
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <input
                                          type="number"
                                          min={0}
                                          step="any"
                                          value={item.rate}
                                          onChange={(e) => updateItem(sIdx, iIdx, 'rate', parseFloat(e.target.value) || 0)}
                                          className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg text-right focus:border-border focus:outline-none"
                                        />
                                      </td>
                                      <td className="py-1.5 pl-2">
                                        <div className="flex items-center gap-1">
                                          <MoveButtons
                                            onUp={() => moveItem(sIdx, iIdx, -1)}
                                            onDown={() => moveItem(sIdx, iIdx, 1)}
                                            disabledUp={iIdx === 0}
                                            disabledDown={iIdx === section.items.length - 1}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => removeItem(sIdx, iIdx)}
                                            disabled={section.items.length === 1}
                                            className="text-fg-muted hover:text-red-500 disabled:opacity-40 disabled:hover:text-fg-muted transition-colors"
                                          >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <button
                              type="button"
                              onClick={() => addItem(sIdx)}
                              className="flex items-center gap-1 text-sm font-medium text-accent-fg hover:text-green-900 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                              Add line
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addSection}
                        className="flex items-center gap-1 text-sm font-medium text-accent-fg hover:text-green-900 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add section
                      </button>
                    </div>

                    {saveError && (
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSave(t.id)}
                        disabled={saving}
                        className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60 transition-colors"
                      >
                        {saving ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedId(null)}
                        className="text-sm text-fg-muted hover:text-fg-secondary transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {addingNew ? (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Large Works"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none"
              />
            </div>
          </div>
          {createError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60 transition-colors"
            >
              {creating ? 'Creating…' : 'Create template'}
            </button>
            <button
              type="button"
              onClick={() => { setAddingNew(false); setNewName(''); setNewDescription(''); setCreateError(null) }}
              className="text-sm text-fg-muted hover:text-fg-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          className="rounded-lg bg-green-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-800 transition-colors"
        >
          Add template
        </button>
      )}
    </div>
  )
}

function MoveButtons({
  onUp, onDown, disabledUp, disabledDown,
}: {
  onUp: () => void
  onDown: () => void
  disabledUp: boolean
  disabledDown: boolean
}) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={onUp}
        disabled={disabledUp}
        aria-label="Move up"
        className="text-fg-muted hover:text-fg-secondary disabled:opacity-30 disabled:hover:text-fg-muted transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disabledDown}
        aria-label="Move down"
        className="text-fg-muted hover:text-fg-secondary disabled:opacity-30 disabled:hover:text-fg-muted transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
  )
}
