'use client'

import { useMemo, useState, useTransition } from 'react'
import { saveExtraJobLineItems } from './pricing-actions'
import type { ExtraJobLine as ExistingLine, ExtraJobSection as ExistingSection } from '@/lib/extraJobLines'
import {
  DragHandle, EmptySectionNotice, SortableItems, SortableRow, SortableSectionCard, SortableSections,
  newUid, sectionLabel,
} from '@/app/_components/SortableSections'

// ── Types ─────────────────────────────────────────────────────────────────────

type MulchOption = { key: string; label: string; itemName: string; rate: number | null }

type Presets = {
  labourRate: number | null
  bobcatRate: number | null
  mulchOptions: MulchOption[]
  edgingRate: number | null
  turfRate: number | null
}

type Line = {
  uid: string
  orderIndex: number
  id: string | null
  description: string
  qty: string
  unit: string
  rate: string
  presetKey: string | null
}

type Section = {
  uid: string
  orderIndex: number
  id: string | null
  name: string
  items: Line[]
}

interface Props {
  extraJobId: string
  siteId: string
  stageId: string
  canManage: boolean
  isAdmin: boolean
  existingSections: ExistingSection[]
  // Version of the saved lines this table was loaded from — sent back on save
  // so the server can refuse it if someone else saved in between.
  linesUpdatedAt: string | null
  presets: Presets
}

const INPUT = 'rounded border border-border bg-surface px-2 py-1 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none'
const BLANK_LINE_COUNT = 5

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function blankLine(orderIndex: number): Line {
  return { uid: newUid(), orderIndex, id: null, description: '', qty: '', unit: '', rate: '', presetKey: null }
}

function blankSection(orderIndex: number, lineCount = 1): Section {
  return {
    uid: newUid(), orderIndex, id: null, name: '',
    items: Array.from({ length: lineCount }, (_, i) => blankLine(i)),
  }
}

function fromExisting(e: ExistingLine, orderIndex: number): Line {
  return {
    uid: newUid(),
    orderIndex,
    id: e.id,
    description: e.description,
    qty: e.qty != null ? String(e.qty) : '',
    unit: e.unit,
    rate: e.rate != null ? String(e.rate) : '',
    presetKey: null,
  }
}

function sectionsFromExisting(existing: ExistingSection[]): Section[] {
  if (existing.length === 0) return [blankSection(0, BLANK_LINE_COUNT)]
  return existing.map((s, sIdx) => ({
    uid: newUid(),
    orderIndex: sIdx,
    id: s.id,
    name: s.name,
    items: s.lines.map(fromExisting),
  }))
}

function reindex<T extends { orderIndex: number }>(arr: T[]): T[] {
  return arr.map((item, i) => ({ ...item, orderIndex: i }))
}

// Empty qty or rate counts as $0
function lineTotal(line: Line): number {
  const qty = parseFloat(line.qty) || 0
  const rate = parseFloat(line.rate) || 0
  return qty * rate
}

function sectionTotal(section: Section): number {
  return section.items.reduce((sum, l) => sum + lineTotal(l), 0)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExtraJobLineItems({
  extraJobId, siteId, stageId, canManage, isAdmin, existingSections, linesUpdatedAt: initialLinesUpdatedAt, presets,
}: Props) {
  const [sections, setSections] = useState<Section[]>(() => sectionsFromExisting(existingSections))
  const [linesUpdatedAt, setLinesUpdatedAt] = useState(initialLinesUpdatedAt)
  const [mulchMenuOpen, setMulchMenuOpen] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [saved, setSaved]             = useState(false)
  const [isPending, startTransition]  = useTransition()

  const grandTotal = useMemo(() => sections.reduce((sum, s) => sum + sectionTotal(s), 0), [sections])
  const hasLines = sections.some((s) => s.items.length > 0)

  // Every edit (including a drag) is unsaved until "Save line items".
  function change(update: (prev: Section[]) => Section[]) {
    setSaved(false)
    setSections(update)
  }

  function updateSection(sIdx: number, update: (s: Section) => Section) {
    change((prev) => prev.map((s, i) => (i === sIdx ? update(s) : s)))
  }

  function addLine(sIdx: number) {
    updateSection(sIdx, (s) => ({ ...s, items: [...s.items, blankLine(s.items.length)] }))
  }

  // Quick-add chips add to the last section.
  function addPresetLine(description: string, unit: string, rate: number | null, presetKey: string) {
    const last = sections.length - 1
    if (last < 0) {
      change(() => [{
        ...blankSection(0, 0),
        items: [{ ...blankLine(0), description, qty: '1', unit, rate: rate != null ? String(rate) : '', presetKey }],
      }])
    } else {
      updateSection(last, (s) => ({
        ...s,
        items: [...s.items, { ...blankLine(s.items.length), description, qty: '1', unit, rate: rate != null ? String(rate) : '', presetKey }],
      }))
    }
    setMulchMenuOpen(false)
  }

  function removeLine(sIdx: number, idx: number) {
    updateSection(sIdx, (s) => ({ ...s, items: reindex(s.items.filter((_, i) => i !== idx)) }))
  }

  function updateLine<K extends 'description' | 'qty' | 'unit' | 'rate'>(sIdx: number, idx: number, key: K, value: string) {
    updateSection(sIdx, (s) => ({
      ...s,
      items: s.items.map((l, i) => {
        if (i !== idx) return l
        // Manually editing the rate detaches the line from its preset so a
        // future save doesn't silently overwrite the admin's override.
        if (key === 'rate' && l.presetKey) return { ...l, rate: value, presetKey: null }
        return { ...l, [key]: value }
      }),
    }))
  }

  function renameSection(sIdx: number, name: string) {
    updateSection(sIdx, (s) => ({ ...s, name }))
  }

  function addSection() {
    change((prev) => [...prev, blankSection(prev.length)])
  }

  // Only offered once a section is empty, so no line is ever deleted with it.
  function removeSection(sIdx: number) {
    change((prev) => reindex(prev.filter((s, i) => i !== sIdx || s.items.length > 0)))
  }

  function handleSave() {
    setSaved(false)
    setError(null)
    const fd = new FormData()
    fd.set('extra_job_id', extraJobId)
    fd.set('site_id', siteId)
    fd.set('stage_id', stageId)
    fd.set('lines_updated_at', linesUpdatedAt ?? '')
    fd.set('sections', JSON.stringify(sections.map((s) => ({
      id:    s.id,
      name:  s.name,
      lines: s.items.map((l) => ({
        id:          l.id,
        description: l.description,
        qty:         l.qty,
        unit:        l.unit,
        rate:        isAdmin ? l.rate : '',
        presetKey:   l.presetKey,
      })),
    }))))

    startTransition(async () => {
      const result = await saveExtraJobLineItems(null, fd)
      if (result.error) {
        setError(result.error)
        return
      }
      // Reload from what was saved, so new sections and lines carry their
      // real ids into the next save (and prices kept server-side stay attached).
      if (result.sections) setSections(sectionsFromExisting(result.sections))
      setLinesUpdatedAt(result.linesUpdatedAt ?? null)
      setSaved(true)
    })
  }

  const chip = 'rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-raised transition-colors'
  const th = 'text-xs font-semibold text-fg-secondary uppercase tracking-wide py-2'
  const showSubtotals = isAdmin && sections.length >= 2

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => addPresetLine('Labour', 'hr', presets.labourRate, 'labour')} className={chip}>
            {isAdmin && presets.labourRate != null ? `+ Labour $${presets.labourRate}/hr` : '+ Labour (hr)'}
          </button>
          <button type="button" onClick={() => addPresetLine('Bobcat', 'hr', presets.bobcatRate, 'bobcat')} className={chip}>
            {isAdmin && presets.bobcatRate != null ? `+ Bobcat $${presets.bobcatRate}/hr` : '+ Bobcat (hr)'}
          </button>

          <div className="relative">
            <button type="button" onClick={() => setMulchMenuOpen((o) => !o)} className={chip}>
              + Mulch (m²)
            </button>
            {mulchMenuOpen && (
              <div className="absolute z-10 mt-1 w-48 rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
                {presets.mulchOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => addPresetLine(opt.itemName, 'm²', opt.rate, opt.key)}
                    className="block w-full text-left px-3 py-1.5 text-xs text-fg-secondary hover:bg-surface-raised transition-colors"
                  >
                    {opt.label}{isAdmin && opt.rate != null ? ` — $${opt.rate.toFixed(2)}/m²` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={() => addPresetLine('Steel Edging', 'lm', presets.edgingRate, 'edging')} className={chip}>
            {isAdmin && presets.edgingRate != null ? `+ Edging $${presets.edgingRate}/lm` : '+ Edging (lm)'}
          </button>
          <button type="button" onClick={() => addPresetLine('Artificial Turf', 'm²', presets.turfRate, 'turf')} className={chip}>
            {isAdmin && presets.turfRate != null ? `+ Turf $${presets.turfRate}/m²` : '+ Turf (m²)'}
          </button>
        </div>
      )}

      {!canManage && !hasLines && (
        <div className="rounded-xl border border-border bg-surface px-3 py-4 text-center text-sm text-fg-muted italic">
          No line items.
        </div>
      )}

      <SortableSections
        sections={sections}
        onChange={(next) => change(() => next)}
        sectionLabel={sectionLabel}
        itemLabel={(item) => item.description || 'Line item'}
      >
        <div className="space-y-3">
          {sections.map((section, sIdx) => {
            // Read-only viewers don't see empty sections or blank headings
            if (!canManage && section.items.length === 0) return null
            return (
              <SortableSectionCard key={section.uid} uid={section.uid} className="rounded-xl border border-border bg-surface overflow-hidden">
                {(sectionHandle) => (<>
                  {canManage ? (
                    <div className="flex items-center gap-2 bg-surface-raised px-3 py-2">
                      <DragHandle handle={sectionHandle} label="Drag to reorder section" />
                      <input
                        type="text"
                        value={section.name}
                        onChange={(e) => renameSection(sIdx, e.target.value)}
                        placeholder="Section name (optional)"
                        className={`${INPUT} flex-1 font-medium`}
                      />
                    </div>
                  ) : section.name.trim() ? (
                    <div className="bg-surface-raised px-3 py-2 text-sm font-semibold text-fg-secondary">{section.name}</div>
                  ) : null}

                  {canManage && section.items.length === 0 && (
                    <div className="p-3">
                      <EmptySectionNotice onDelete={() => removeSection(sIdx)} />
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse table-fixed">
                      {/* Description is the only column with no explicit width, so under
                          table-fixed it absorbs all remaining space — the other columns
                          stay compact regardless of container width. */}
                      <colgroup>
                        {canManage && <col className="w-9" />}
                        <col />
                        <col className="w-20" />
                        <col className="w-20" />
                        {isAdmin && <col className="w-24" />}
                        {isAdmin && <col className="w-28" />}
                        {canManage && <col className="w-10" />}
                      </colgroup>
                      {section.items.length > 0 && (
                        <thead>
                          <tr className="border-b border-border">
                            {canManage && <th className="py-2"></th>}
                            <th className={`${th} text-left px-3`}>Description</th>
                            <th className={`${th} text-right px-2`}>Qty</th>
                            <th className={`${th} text-left px-2`}>Unit</th>
                            {isAdmin && <th className={`${th} text-right px-2`}>Rate</th>}
                            {isAdmin && <th className={`${th} text-right px-2`}>Total</th>}
                            {canManage && <th className="px-2 py-2"></th>}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        <SortableItems items={section.items}>
                          {section.items.map((line, i) => (
                            <SortableRow key={line.uid} uid={line.uid} className="border-b border-border-subtle last:border-b-0">
                              {(itemHandle) => (<>
                                {canManage && (
                                  <td className="py-1.5 pl-2">
                                    <DragHandle handle={itemHandle} label="Drag to move line item" />
                                  </td>
                                )}
                                <td className="px-3 py-1.5">
                                  {canManage ? (
                                    <input
                                      type="text"
                                      value={line.description}
                                      onChange={(e) => updateLine(sIdx, i, 'description', e.target.value)}
                                      placeholder="Description"
                                      className={`${INPUT} w-full`}
                                    />
                                  ) : (
                                    <span className="text-fg-secondary">{line.description || '—'}</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  {canManage ? (
                                    <input
                                      type="number" min="0" step="any"
                                      value={line.qty}
                                      onChange={(e) => updateLine(sIdx, i, 'qty', e.target.value)}
                                      placeholder="0"
                                      className={`${INPUT} w-full text-right tabular-nums`}
                                    />
                                  ) : (
                                    <span className="block text-right tabular-nums text-fg-secondary">{line.qty || '—'}</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  {canManage ? (
                                    <input
                                      type="text"
                                      value={line.unit}
                                      onChange={(e) => updateLine(sIdx, i, 'unit', e.target.value)}
                                      placeholder="unit"
                                      className={`${INPUT} w-full`}
                                    />
                                  ) : (
                                    <span className="text-fg-secondary">{line.unit || '—'}</span>
                                  )}
                                </td>
                                {isAdmin && (
                                  <td className="px-2 py-1.5">
                                    <input
                                      type="number" min="0" step="any"
                                      value={line.rate}
                                      onChange={(e) => updateLine(sIdx, i, 'rate', e.target.value)}
                                      placeholder="0.00"
                                      className={`${INPUT} w-full text-right tabular-nums`}
                                    />
                                  </td>
                                )}
                                {isAdmin && (
                                  <td className="px-2 py-1.5 text-right text-sm tabular-nums text-fg-secondary">
                                    {lineTotal(line) > 0 ? fmt(lineTotal(line)) : <span className="text-fg-muted">—</span>}
                                  </td>
                                )}
                                {canManage && (
                                  <td className="px-2 py-1.5">
                                    <button
                                      type="button"
                                      onClick={() => removeLine(sIdx, i)}
                                      aria-label="Remove line"
                                      className="text-fg-muted hover:text-red-500 transition-colors"
                                    >
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </td>
                                )}
                              </>)}
                            </SortableRow>
                          ))}
                        </SortableItems>
                      </tbody>
                    </table>
                  </div>

                  {(canManage || (showSubtotals && section.items.length > 0)) && (
                    <div className="px-3 py-2.5 border-t border-border-subtle flex items-center justify-between gap-3">
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => addLine(sIdx)}
                          className="flex items-center gap-1 text-sm font-medium text-accent-fg hover:text-green-900 transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Add line
                        </button>
                      ) : <span />}
                      {showSubtotals && (
                        <span className="text-sm text-fg-secondary">
                          Subtotal <span className="ml-2 font-semibold tabular-nums text-fg">{fmt(sectionTotal(section))}</span>
                        </span>
                      )}
                    </div>
                  )}
                </>)}
              </SortableSectionCard>
            )
          })}
        </div>
      </SortableSections>

      {canManage && (
        <button
          type="button"
          onClick={addSection}
          className="w-full rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-medium text-fg-muted hover:bg-surface-raised transition-colors"
        >
          + Add section
        </button>
      )}

      {isAdmin && (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-fg-secondary">Total (ex GST)</span>
          <span className="text-lg font-bold text-fg">{fmt(grandTotal)}</span>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-lg bg-accent-dim px-3 py-2 text-sm text-accent-fg">Saved successfully.</p>}

      {canManage && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save line items'}
        </button>
      )}
    </div>
  )
}
