'use client'

import { useState, useMemo, useTransition } from 'react'
import { saveLotQuote } from './quote-actions'
import type { QuoteItemPayload } from './quote-actions'

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateItem = {
  id: string
  name: string
  unit: string
  unit_price: number | null
  is_auto_calculated: boolean
  auto_calc_formula: string | null
  plant_category: 'front' | 'rear' | null
  order_index: number
}

type TemplateSection = {
  id: string
  name: string
  order_index: number
  items: TemplateItem[]
}

type QuoteData = {
  id: string
  status: 'draft' | 'submitted' | 'approved'
  notes: string | null
  items: { template_item_id: string; quantity: number | null; unit_price_snapshot: number | null }[]
} | null

type Props = {
  lotId: string
  siteId: string
  stageId: string
  isAdmin: boolean
  canManage: boolean
  sections: TemplateSection[]
  estimatedQuote: QuoteData
  finalQuote: QuoteData
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initQty(quote: QuoteData): Record<string, string> {
  if (!quote) return {}
  return Object.fromEntries(
    quote.items
      .filter((i) => i.quantity !== null)
      .map((i) => [i.template_item_id, String(i.quantity)])
  )
}

function computeAutoCalc(
  formula: string | null,
  qty: Record<string, string>,
  allItems: TemplateItem[]
): number {
  if (!formula) return 0
  const front = allItems
    .filter((i) => i.plant_category === 'front')
    .reduce((s, i) => s + (parseFloat(qty[i.id] || '0') || 0), 0)
  const rear = allItems
    .filter((i) => i.plant_category === 'rear')
    .reduce((s, i) => s + (parseFloat(qty[i.id] || '0') || 0), 0)
  const all = front + rear
  switch (formula) {
    case 'front_plants':    return front
    case 'rear_plants':     return rear
    case 'all_plants':      return all
    case 'all_plants_x0.5': return Math.round(all * 0.5 * 10) / 10
    default:                return 0
  }
}

function fmt(n: number, unit: string): string {
  if (unit === 'Lin M' || unit === 'm²' || unit === 'm³') {
    return n % 1 === 0 ? String(n) : n.toFixed(1)
  }
  return String(Math.round(n))
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LotQuantities({
  lotId, siteId, stageId,
  isAdmin, canManage,
  sections, estimatedQuote, finalQuote,
}: Props) {
  const [isEstimated, setIsEstimated] = useState(true)
  const activeQuote = isEstimated ? estimatedQuote : finalQuote

  const [quantities, setQuantities] = useState<Record<string, string>>(() => initQty(estimatedQuote))
  const [notes, setNotes]           = useState(estimatedQuote?.notes ?? '')
  const [error, setError]           = useState<string | null>(null)
  const [saved, setSaved]           = useState(false)
  const [isPending, startTransition] = useTransition()

  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections])

  // Auto-calculated values derived from current quantities
  const autoCalcValues = useMemo(() => {
    const result: Record<string, number> = {}
    allItems
      .filter((i) => i.is_auto_calculated)
      .forEach((i) => {
        result[i.id] = computeAutoCalc(i.auto_calc_formula, quantities, allItems)
      })
    return result
  }, [quantities, allItems])

  function switchMode(estimated: boolean) {
    const quote = estimated ? estimatedQuote : finalQuote
    setIsEstimated(estimated)
    setQuantities(initQty(quote))
    setNotes(quote?.notes ?? '')
    setError(null)
    setSaved(false)
  }

  function setQty(itemId: string, value: string) {
    setSaved(false)
    setQuantities((prev) => ({ ...prev, [itemId]: value }))
  }

  function toggleCornerLot(itemId: string) {
    const current = quantities[itemId] === '1'
    setQty(itemId, current ? '0' : '1')
  }

  function handleSave(submitStatus: 'draft' | 'submitted') {
    setError(null)
    setSaved(false)

    const items: QuoteItemPayload[] = allItems.map((item) => {
      const rawQty = item.is_auto_calculated
        ? autoCalcValues[item.id] ?? null
        : quantities[item.id] !== undefined && quantities[item.id] !== ''
          ? parseFloat(quantities[item.id])
          : null

      return {
        template_item_id:    item.id,
        item_name:           item.name,
        unit:                item.unit,
        quantity:            rawQty === null || isNaN(rawQty as number) ? null : rawQty as number,
        unit_price_snapshot: isAdmin ? item.unit_price : null,
      }
    })

    startTransition(async () => {
      const result = await saveLotQuote({
        lotId, siteId, stageId, isEstimated,
        status: submitStatus,
        notes,
        items,
      })
      if (result?.error) {
        setError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  const currentStatus = activeQuote?.status ?? 'draft'
  const isApproved    = currentStatus === 'approved'

  return (
    <div className="space-y-4">

      {/* Estimate / Final toggle */}
      <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1 self-start w-fit">
        <button
          type="button"
          onClick={() => switchMode(true)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isEstimated ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          Estimate
        </button>
        <button
          type="button"
          onClick={() => switchMode(false)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !isEstimated ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          Final
        </button>
      </div>

      {/* Status badge */}
      {activeQuote && (
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            currentStatus === 'approved'  ? 'bg-green-100 text-green-700' :
            currentStatus === 'submitted' ? 'bg-blue-100 text-blue-700'   :
            'bg-stone-100 text-stone-600'
          }`}>
            {currentStatus === 'approved' ? 'Approved' : currentStatus === 'submitted' ? 'Submitted' : 'Draft'}
          </span>
        </div>
      )}

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          {/* Section header */}
          <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
            <h3 className="text-sm font-semibold text-stone-700">{section.name}</h3>
          </div>

          {/* Column headers — admin sees extra price columns */}
          <div className={`grid gap-3 px-4 py-2 border-b border-stone-100 text-xs font-medium text-stone-400 ${isAdmin ? 'grid-cols-[1fr_80px_80px_80px]' : 'grid-cols-[1fr_80px]'}`}>
            <span>Item</span>
            <span className="text-right">Qty</span>
            {isAdmin && <><span className="text-right">$/unit</span><span className="text-right">Total</span></>}
          </div>

          {/* Items */}
          {section.items.map((item) => {
            const isToggle   = item.unit === 'toggle'
            const isAutoCalc = item.is_auto_calculated
            const isCornerYes = quantities[item.id] === '1'

            // Resolved quantity for display / price calc
            const resolvedQty = isAutoCalc
              ? (autoCalcValues[item.id] ?? 0)
              : isToggle
                ? (isCornerYes ? 1 : 0)
                : parseFloat(quantities[item.id] || '0') || 0

            const lineTotal = isAdmin && item.unit_price != null
              ? resolvedQty * item.unit_price
              : null

            return (
              <div
                key={item.id}
                className={`grid gap-3 px-4 py-3 border-b border-stone-100 items-center ${
                  isAdmin ? 'grid-cols-[1fr_80px_80px_80px]' : 'grid-cols-[1fr_80px]'
                }`}
              >
                {/* Name */}
                <div className="min-w-0">
                  <span className="text-sm text-stone-800">{item.name}</span>
                  {isAutoCalc && (
                    <span className="ml-1.5 text-xs text-blue-500">auto</span>
                  )}
                </div>

                {/* Quantity input / display */}
                <div className="flex justify-end">
                  {isAutoCalc ? (
                    <span className="text-sm font-medium text-stone-700 tabular-nums">
                      {fmt(autoCalcValues[item.id] ?? 0, item.unit)}
                      <span className="ml-1 text-xs text-stone-400">{item.unit}</span>
                    </span>
                  ) : isToggle ? (
                    <button
                      type="button"
                      onClick={() => toggleCornerLot(item.id)}
                      disabled={isApproved || !canManage}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        isCornerYes
                          ? 'bg-green-100 text-green-700'
                          : 'bg-stone-100 text-stone-500'
                      } disabled:opacity-50`}
                    >
                      {isCornerYes ? 'YES' : 'NO'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={quantities[item.id] ?? ''}
                        onChange={(e) => setQty(item.id, e.target.value)}
                        disabled={isApproved || !canManage}
                        placeholder="0"
                        className="w-16 rounded-lg border border-stone-300 px-2 py-2 text-sm text-right tabular-nums focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:bg-stone-50 disabled:text-stone-400"
                      />
                      <span className="text-xs text-stone-400 shrink-0">{item.unit}</span>
                    </div>
                  )}
                </div>

                {/* Admin: unit price + line total */}
                {isAdmin && (
                  <>
                    <div className="text-right text-sm text-stone-500 tabular-nums">
                      {item.unit_price != null ? `$${item.unit_price.toFixed(2)}` : <span className="text-stone-300">—</span>}
                    </div>
                    <div className="text-right text-sm font-medium text-stone-700 tabular-nums">
                      {lineTotal != null ? `$${lineTotal.toFixed(2)}` : <span className="text-stone-300">—</span>}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Admin: grand total */}
      {isAdmin && (() => {
        const grandTotal = allItems.reduce((sum, item) => {
          if (item.unit_price == null) return sum
          const qty = item.is_auto_calculated
            ? (autoCalcValues[item.id] ?? 0)
            : parseFloat(quantities[item.id] || '0') || 0
          return sum + qty * item.unit_price
        }, 0)
        return grandTotal > 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-stone-700">Estimated total</span>
            <span className="text-lg font-bold text-stone-900">${grandTotal.toFixed(2)}</span>
          </div>
        ) : null
      })()}

      {/* Notes */}
      {canManage && !isApproved && (
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any notes about this quantity takeoff…"
            className="block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
          />
        </div>
      )}

      {/* Feedback */}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {saved && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Saved successfully.</p>
      )}

      {/* Actions */}
      {canManage && !isApproved && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={isPending}
            className="flex-1 rounded-lg border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => handleSave('submitted')}
            disabled={isPending}
            className="flex-1 rounded-lg bg-green-700 px-4 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {isPending ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  )
}
