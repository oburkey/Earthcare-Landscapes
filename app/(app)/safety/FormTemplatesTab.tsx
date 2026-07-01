'use client'

import { useState } from 'react'
import { createTemplate, updateTemplate, setTemplateActive } from './forms-actions'
import type { SafetyFormType, FormSection, FormItem, FormItemType } from '@/types/database'

export type TemplateRow = {
  id: string
  title: string
  formType: SafetyFormType
  description: string | null
  isSiteSpecific: boolean
  requireWitness: boolean
  sections: FormSection[]
  contentHtml: string | null
  isActive: boolean
  createdAt: string
}

interface Props {
  templates: TemplateRow[]
  tableExists: boolean
}

const TYPE_OPTIONS: Array<{ value: SafetyFormType; label: string }> = [
  { value: 'interactive', label: 'Interactive (checklist + signature)' },
  { value: 'swms',        label: 'SWMS sign-on' },
  { value: 'jsa',         label: 'JSA sign-on' },
  { value: 'reference',   label: 'Reference document (no sign-on)' },
]

const ITEM_TYPE_OPTIONS: Array<{ value: FormItemType; label: string }> = [
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'yes_no',   label: 'Yes / No' },
  { value: 'text',     label: 'Text response' },
]

function blankItem(): FormItem {
  return { id: crypto.randomUUID(), label: '', type: 'checkbox', required: false }
}

function blankSection(): FormSection {
  return { title: '', items: [blankItem()] }
}

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; template: TemplateRow }
  | null

export default function FormTemplatesTab({ templates: initial, tableExists }: Props) {
  const [templates, setTemplates] = useState<TemplateRow[]>(initial)
  const [modal, setModal]         = useState<ModalState>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [toggling, setToggling]   = useState<string | null>(null)

  // Form builder state
  const [title, setTitle]               = useState('')
  const [formType, setFormType]         = useState<SafetyFormType>('interactive')
  const [description, setDescription]   = useState('')
  const [isSiteSpecific, setSiteSpecific] = useState(false)
  const [requireWitness, setRequireWitness] = useState(false)
  const [sections, setSections]         = useState<FormSection[]>([blankSection()])
  const [contentHtml, setContentHtml]   = useState('')

  function openCreate() {
    setTitle(''); setFormType('interactive'); setDescription(''); setSiteSpecific(false)
    setRequireWitness(false); setSections([blankSection()]); setContentHtml(''); setError(null)
    setModal({ mode: 'create' })
  }

  function openEdit(t: TemplateRow) {
    setTitle(t.title); setFormType(t.formType); setDescription(t.description ?? '')
    setSiteSpecific(t.isSiteSpecific); setRequireWitness(t.requireWitness)
    setSections(t.sections.length ? t.sections : [blankSection()]); setContentHtml(t.contentHtml ?? '')
    setError(null)
    setModal({ mode: 'edit', template: t })
  }

  // Section / item helpers
  const addSection    = () => setSections(s => [...s, blankSection()])
  const removeSection = (si: number) => setSections(s => s.filter((_, i) => i !== si))
  const updateSectionTitle = (si: number, v: string) =>
    setSections(s => s.map((sec, i) => i === si ? { ...sec, title: v } : sec))
  const addItem = (si: number) =>
    setSections(s => s.map((sec, i) => i === si ? { ...sec, items: [...sec.items, blankItem()] } : sec))
  const removeItem = (si: number, ii: number) =>
    setSections(s => s.map((sec, i) => i === si ? { ...sec, items: sec.items.filter((_, j) => j !== ii) } : sec))
  const updateItem = (si: number, ii: number, patch: Partial<FormItem>) =>
    setSections(s => s.map((sec, i) => i === si ? {
      ...sec, items: sec.items.map((item, j) => j === ii ? { ...item, ...patch } : item)
    } : sec))

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        title:            title.trim(),
        form_type:        formType,
        description:      description.trim() || null,
        is_site_specific: isSiteSpecific,
        require_witness:  requireWitness,
        sections:         formType === 'interactive' ? sections : [],
        content_html:     (formType === 'swms' || formType === 'jsa') ? contentHtml.trim() || null : null,
      }

      if (modal?.mode === 'create') {
        const result = await createTemplate(payload)
        if (result?.error) { setError(result.error); return }
        if (result.template) {
          const r = result.template
          setTemplates(prev => [{
            id: r.id, title: r.title, formType: r.form_type as SafetyFormType,
            description: r.description, isSiteSpecific: r.is_site_specific,
            requireWitness: r.require_witness, sections: r.sections as FormSection[],
            contentHtml: r.content_html, isActive: r.is_active, createdAt: r.created_at,
          }, ...prev])
        }
      } else if (modal?.mode === 'edit') {
        const result = await updateTemplate(modal.template.id, payload)
        if (result?.error) { setError(result.error); return }
        setTemplates(prev => prev.map(t => t.id === modal.template.id
          ? { ...t, ...payload, formType: payload.form_type as SafetyFormType,
              isSiteSpecific: payload.is_site_specific, requireWitness: payload.require_witness,
              contentHtml: payload.content_html }
          : t
        ))
      }

      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(t: TemplateRow) {
    setToggling(t.id)
    const result = await setTemplateActive(t.id, !t.isActive)
    setToggling(null)
    if (result?.error) { setError(result.error); return }
    setTemplates(prev => prev.map(tp => tp.id === t.id ? { ...tp, isActive: !tp.isActive } : tp))
  }

  if (!tableExists) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center">
        <p className="text-sm text-fg-muted">Safety forms tables not yet set up. Run the SQL migration to enable this feature.</p>
      </div>
    )
  }

  return (
    <>
      {/* Template list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-fg-muted">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 transition-colors"
          >
            + New template
          </button>
        </div>

        {error && !modal && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {templates.length === 0 && (
          <p className="text-sm text-fg-muted">No templates yet.</p>
        )}

        <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
          {templates.map(t => (
            <div key={t.id} className={`flex items-center justify-between px-4 py-3 gap-3 ${!t.isActive ? 'opacity-50' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-sm font-medium text-fg">{t.title}</span>
                  <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium bg-surface-raised text-fg-muted capitalize">
                    {t.formType.replace('_', ' ')}
                  </span>
                  {t.isSiteSpecific && (
                    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium bg-surface-raised text-fg-muted">
                      Site-specific
                    </span>
                  )}
                  {!t.isActive && (
                    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium bg-surface-raised text-fg-muted">
                      Inactive
                    </span>
                  )}
                </div>
                {t.description && <p className="text-xs text-fg-muted truncate">{t.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(t)}
                  disabled={toggling === t.id}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50 transition-colors"
                >
                  {t.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-xl space-y-5 p-6">
            <h3 className="text-base font-semibold text-fg">
              {modal.mode === 'create' ? 'New form template' : 'Edit template'}
            </h3>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600"
                placeholder="e.g. Site Induction Checklist"
              />
            </div>

            {/* Type (only on create) */}
            {modal.mode === 'create' && (
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Type *</label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value as SafetyFormType)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-green-600"
                >
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Description</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600"
                placeholder="Optional short description"
              />
            </div>

            {/* Toggles */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSiteSpecific}
                  onChange={e => setSiteSpecific(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-green-700 focus:ring-green-600 focus:ring-1 focus:outline-none"
                />
                <span className="text-sm text-fg">Site-specific</span>
              </label>
              {formType !== 'reference' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireWitness}
                    onChange={e => setRequireWitness(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-green-700 focus:ring-green-600 focus:ring-1 focus:outline-none"
                  />
                  <span className="text-sm text-fg">Require witness signature</span>
                </label>
              )}
            </div>

            {/* Interactive: section builder */}
            {formType === 'interactive' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-fg">Sections</h4>
                  <button
                    type="button"
                    onClick={addSection}
                    className="text-xs font-medium text-accent-fg hover:underline"
                  >
                    + Add section
                  </button>
                </div>

                {sections.map((section, si) => (
                  <div key={si} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={section.title}
                        onChange={e => updateSectionTitle(si, e.target.value)}
                        placeholder="Section title"
                        className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600"
                      />
                      {sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(si)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {section.items.map((item, ii) => (
                        <div key={item.id} className="flex items-start gap-2">
                          <input
                            value={item.label}
                            onChange={e => updateItem(si, ii, { label: e.target.value })}
                            placeholder="Item label"
                            className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600"
                          />
                          <select
                            value={item.type}
                            onChange={e => updateItem(si, ii, { type: e.target.value as FormItemType })}
                            className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-green-600"
                          >
                            {ITEM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <label className="flex items-center gap-1 pt-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.required}
                              onChange={e => updateItem(si, ii, { required: e.target.checked })}
                              className="h-3.5 w-3.5 rounded border-border text-green-700 focus:ring-green-600 focus:ring-1 focus:outline-none"
                            />
                            <span className="text-xs text-fg-muted">Req.</span>
                          </label>
                          {section.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(si, ii)}
                              className="pt-1 text-xs text-red-400 hover:text-red-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => addItem(si)}
                      className="text-xs font-medium text-accent-fg hover:underline"
                    >
                      + Add item
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* SWMS / JSA: content HTML */}
            {(formType === 'swms' || formType === 'jsa') && (
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Document content (HTML)
                </label>
                <textarea
                  rows={10}
                  value={contentHtml}
                  onChange={e => setContentHtml(e.target.value)}
                  placeholder="Paste or type the document HTML content here. Workers will read this before signing."
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg font-mono placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600 resize-y"
                />
                <p className="mt-1 text-xs text-fg-muted">Rendered as HTML. Use basic &lt;p&gt;, &lt;ul&gt;, &lt;h3&gt; tags.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : modal.mode === 'create' ? 'Create template' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
