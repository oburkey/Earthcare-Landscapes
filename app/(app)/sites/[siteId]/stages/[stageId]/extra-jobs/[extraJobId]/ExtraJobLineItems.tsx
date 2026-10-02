'use client'

import { useMemo, useState, useTransition } from 'react'
import { saveExtraJobLineItems } from './pricing-actions'

// ── Types ─────────────────────────────────────────────────────────────────────

type ExistingLine = {
  id: string
  description: string
  qty: number | null
  unit: string
  rate: number | null
}

type MulchOption = { key: string; label: string; itemName: string; rate: number | null }

type Presets = {
  labourRate: number | null
  bobcatRate: number | null
  mulchOptions: MulchOption[]
  edgingRate: number | null
  turfRate: number | null
}

type Line = {
  id: string | null
  description: string
  qty: string
  unit: string
  rate: string
  presetKey: string | null
}

interface Props {
  extraJobId: string
  siteId: string
  stageId: string
  canManage: boolean
  isAdmin: boolean
  existingLines: ExistingLine[]
  presets: Presets
}

const INPUT = 'rounded border border-border bg-surface px-2 py-1 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none'
const BLANK_LINE_COUNT = 5

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function blankLine(): Line {
  return { id: null, description: '', qty: '', unit: '', rate: '', presetKey: null }
}

function fromExisting(e: ExistingLine): Line {
  return {
    id: e.id,
    description: e.description,
    qty: e.qty != null ? String(e.qty) : '',
    unit: e.unit,
    rate: e.rate != null ? String(e.rate) : '',
    presetKey: null,
  }
}

function lineTotal(line: Line): number {
  const qty = parseFloat(line.qty) || 0
  const rate = parseFloat(line.rate) || 0
  return qty * rate
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExtraJobLineItems({
  extraJobId, siteId, stageId, canManage, isAdmin, existingLines, presets,
}: Props) {
  const [lines, setLines] = useState<Line[]>(() =>
    existingLines.length > 0
      ? existingLines.map(fromExisting)
      : Array.from({ length: BLANK_LINE_COUNT }, blankLine)
  )
  const [mulchMenuOpen, setMulchMenuOpen] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [saved, setSaved]             = useState(false)
  const [isPending, startTransition]  = useTransition()

  const grandTotal = useMemo(() => lines.reduce((sum, l) => sum + lineTotal(l), 0), [lines])

  function addLine() {
    setSaved(false)
    setLines((prev) => [...prev, blankLine()])
  }

  function addPresetLine(description: string, unit: string, rate: number | null, presetKey: string) {
    setSaved(false)
    setLines((prev) => [
      ...prev,
      { id: null, description, qty: '1', unit, rate: rate != null ? String(rate) : '', presetKey },
    ])
    setMulchMenuOpen(false)
  }

  function removeLine(idx: number) {
    setSaved(false)
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateLine<K extends keyof Line>(idx: number, key: K, value: Line[K]) {
    setSaved(false)
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l
      // Manually editing the rate detaches the line from its preset so a
      // future save doesn't silently overwrite the admin's override.
      if (key === 'rate' && l.presetKey) return { ...l, rate: value as string, presetKey: null }
      return { ...l, [key]: value }
    }))
  }

  function handleSave() {
    setSaved(false)
    setError(null)
    const fd = new FormData()
    fd.set('extra_job_id', extraJobId)
    fd.set('site_id', siteId)
    fd.set('stage_id', stageId)
    fd.set('lines', JSON.stringify(lines.map((l) => ({
      id:          l.id,
      description: l.description,
      qty:         l.qty,
      unit:        l.unit,
      rate:        isAdmin ? l.rate : '',
      presetKey:   l.presetKey,
    }))))

    startTransition(async () => {
      const result = await saveExtraJobLineItems(null, fd)
      if (result?.error) setError(result.error)
      else setSaved(true)
    })
  }

  const chip = 'rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-raised transition-colors'

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

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-semibold text-fg-secondary uppercase tracking-wide px-3 py-2 min-w-[160px]">Description</th>
                <th className="text-right text-xs font-semibold text-fg-secondary uppercase tracking-wide px-2 py-2 w-16">Qty</th>
                <th className="text-left text-xs font-semibold text-fg-secondary uppercase tracking-wide px-2 py-2 w-16">Unit</th>
                {isAdmin && <th className="text-right text-xs font-semibold text-fg-secondary uppercase tracking-wide px-2 py-2 w-20">Rate</th>}
                {isAdmin && <th className="text-right text-xs font-semibold text-fg-secondary uppercase tracking-wide px-2 py-2 w-24">Total</th>}
                {canManage && <th className="w-10 px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b border-border-subtle last:border-b-0">
                  <td className="px-3 py-1.5">
                    {canManage ? (
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(i, 'description', e.target.value)}
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
                        onChange={(e) => updateLine(i, 'qty', e.target.value)}
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
                        onChange={(e) => updateLine(i, 'unit', e.target.value)}
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
                        onChange={(e) => updateLine(i, 'rate', e.target.value)}
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
                        onClick={() => removeLine(i)}
                        className="text-fg-muted hover:text-red-500 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : canManage ? 4 : 3} className="px-3 py-4 text-center text-sm text-fg-muted italic">
                    No line items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <div className="px-3 py-2.5 border-t border-border-subtle">
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 text-sm font-medium text-accent-fg hover:text-green-900 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add line
            </button>
          </div>
        )}
      </div>

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
