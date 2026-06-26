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
  isClientExtra?: boolean
}

type TemplateSection = {
  id: string
  name: string
  order_index: number
  items: TemplateItem[]
  isClientExtra?: boolean
}

type QuoteData = {
  id: string
  status: 'draft' | 'submitted' | 'approved'
  notes: string | null
  items: { template_item_id: string; quantity: number | null; unit_price_snapshot: number | null }[]
} | null

type PlantRatios = {
  frontRatio: number
  rearRatio: number
  frontPotSplit: Record<string, number>
  rearPotSplit: Record<string, number>
}

type Props = {
  lotId: string
  siteId: string
  stageId: string
  isAdmin: boolean
  canManage: boolean
  sections: TemplateSection[]
  estimatedQuote: QuoteData
  finalQuote: QuoteData
  showClientExtras?: boolean
  contractPrice?: number | null
  plantRatios?: PlantRatios
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildVariantGroups(allItems: TemplateItem[]): {
  variantGroups: Map<string, TemplateItem[]>
  secondaryIds: Set<string>
} {
  const variantGroups = new Map<string, TemplateItem[]>()
  for (const item of allItems) {
    const m = item.auto_calc_formula?.match(/^variant_group:(.+)$/)
    if (m) {
      const group = m[1]
      if (!variantGroups.has(group)) variantGroups.set(group, [])
      variantGroups.get(group)!.push(item)
    }
  }
  const secondaryIds = new Set<string>()
  variantGroups.forEach((items) => {
    for (let i = 1; i < items.length; i++) secondaryIds.add(items[i].id)
  })
  return { variantGroups, secondaryIds }
}

function initValues(quote: QuoteData): Record<string, string> {
  if (!quote) return {}
  return Object.fromEntries(
    quote.items
      .filter((i) => i.quantity !== null)
      .map((i) => [i.template_item_id, String(i.quantity)])
  )
}

function initVariantSel(
  quote: QuoteData,
  variantGroups: Map<string, TemplateItem[]>
): Record<string, string> {
  const sel: Record<string, string> = {}
  variantGroups.forEach((items, groupName) => {
    if (items.length > 0) sel[groupName] = items[0].id
  })
  if (quote) {
    variantGroups.forEach((items, groupName) => {
      for (const item of items) {
        const saved = quote.items.find(
          (i) => i.template_item_id === item.id && i.quantity !== null
        )
        if (saved) { sel[groupName] = item.id; break }
      }
    })
  }
  return sel
}

function commonPrefix(strings: string[]): string {
  if (strings.length === 0) return ''
  let prefix = strings[0]
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) prefix = prefix.slice(0, -1)
  }
  return prefix.trimEnd()
}

// Bed m² items used to derive garden bed area for plant auto-calc
const FRONT_BED_NAMES = ['Mulch Limestone 32mm', 'Black Mulch', 'White Mulch']
const FRONT_SECTION = 'Softscape Works — Front'
const REAR_BED_NAMES = ['Limestone Mulch', 'Black Mulch']
const REAR_SECTION = 'Rear & Side Lot'

// Toggle items that should default to YES on a fresh (unsaved) lot
// (Irrigation items moved to ITEM type — always included, no longer toggles)
const DEFAULT_YES_TOGGLES = new Set<string>([])

// ── Component ─────────────────────────────────────────────────────────────────

export default function LotQuantities({
  lotId, siteId, stageId,
  isAdmin, canManage,
  sections, estimatedQuote, finalQuote,
  showClientExtras = true,
  contractPrice,
  plantRatios,
}: Props) {
  const [open, setOpen] = useState(false)
  // Default to Final once estimate data has been saved, so leading hands don't
  // accidentally overwrite the estimate during regular site visits.
  // Also default to Final when a contract price is set.
  const hasEstimateData = !!estimatedQuote && estimatedQuote.items.some((i) => i.quantity !== null)
  const hasContractPrice = contractPrice != null && contractPrice > 0
  const [isEstimated, setIsEstimated] = useState(hasContractPrice ? false : !hasEstimateData)
  const activeQuote = isEstimated ? estimatedQuote : finalQuote
  // The quote matching the initial active mode above — used to seed initial
  // state below (must NOT always be estimatedQuote, or "Final" mode would
  // open showing Estimate data when it defaults to Final).
  const initialQuote = hasEstimateData ? finalQuote : estimatedQuote

  const allItems = useMemo(
    () => sections.flatMap((s) => s.items.map((item) => ({ ...item, isClientExtra: s.isClientExtra ?? false }))),
    [sections]
  )
  const { variantGroups, secondaryIds } = useMemo(
    () => buildVariantGroups(allItems),
    [allItems]
  )

  const [values, setValues] = useState<Record<string, string>>(() => {
    const base = initValues(initialQuote)
    // Seed the four irrigation toggles to YES when there is no saved value for them
    for (const item of allItems) {
      if (item.unit === 'toggle' && DEFAULT_YES_TOGGLES.has(item.name) && !(item.id in base)) {
        base[item.id] = '1'
      }
    }
    return base
  })
  const [variantSel, setVariantSel] = useState<Record<string, string>>(
    () => initVariantSel(initialQuote, variantGroups)
  )
  const [notes, setNotes]           = useState(initialQuote?.notes ?? '')
  const [error, setError]           = useState<string | null>(null)
  const [saved, setSaved]           = useState(false)
  const [isPending, startTransition] = useTransition()

  const cornerFlagItem = useMemo(
    () => allItems.find((i) => i.auto_calc_formula === 'corner_lot_flag'),
    [allItems]
  )
  const isCornerLot = cornerFlagItem ? values[cornerFlagItem.id] === '1' : false

  // Plant auto-calc: map bed m² and plant item IDs
  const plantCalcIds = useMemo(() => {
    const frontBedIds: string[] = []
    const rearBedIds: string[] = []
    const frontPlantIds: Record<string, string> = {}
    const rearPlantIds: Record<string, string> = {}

    for (const section of sections) {
      for (const item of section.items) {
        if (section.name === FRONT_SECTION && FRONT_BED_NAMES.includes(item.name))
          frontBedIds.push(item.id)
        if (section.name === REAR_SECTION && REAR_BED_NAMES.includes(item.name))
          rearBedIds.push(item.id)
        if (item.plant_category === 'front' && item.name === '130/140mm plants')
          frontPlantIds['130mm'] = item.id
        if (item.plant_category === 'front' && item.name === '200mm plants')
          frontPlantIds['200mm'] = item.id
        if (item.plant_category === 'rear' && item.name === '130/140mm plants')
          rearPlantIds['130mm'] = item.id
        if (item.plant_category === 'rear' && item.name === '200mm plants')
          rearPlantIds['200mm'] = item.id
      }
    }
    return { frontBedIds, rearBedIds, frontPlantIds, rearPlantIds }
  }, [sections])

  function computePlantValues(vals: Record<string, string>): Record<string, string> {
    if (!plantRatios) return {}
    const { frontBedIds, rearBedIds, frontPlantIds, rearPlantIds } = plantCalcIds
    const frontM2 = frontBedIds.reduce((s, id) => s + (parseFloat(vals[id] || '0') || 0), 0)
    const rearM2 = rearBedIds.reduce((s, id) => s + (parseFloat(vals[id] || '0') || 0), 0)
    const fp = Math.ceil(frontM2 * plantRatios.frontRatio)
    const rp = Math.ceil(rearM2 * plantRatios.rearRatio)
    const updates: Record<string, string> = {}
    if (frontPlantIds['130mm']) updates[frontPlantIds['130mm']] = String(Math.ceil(fp * (plantRatios.frontPotSplit['130mm'] ?? 75) / 100))
    if (frontPlantIds['200mm']) updates[frontPlantIds['200mm']] = String(Math.ceil(fp * (plantRatios.frontPotSplit['200mm'] ?? 25) / 100))
    if (rearPlantIds['130mm']) updates[rearPlantIds['130mm']] = String(Math.ceil(rp * (plantRatios.rearPotSplit['130mm'] ?? 75) / 100))
    if (rearPlantIds['200mm']) updates[rearPlantIds['200mm']] = String(Math.ceil(rp * (plantRatios.rearPotSplit['200mm'] ?? 25) / 100))
    return updates
  }

  function recalculatePlants() {
    setSaved(false)
    setValues((prev) => ({ ...prev, ...computePlantValues(prev) }))
  }

  function switchMode(estimated: boolean) {
    const quote = estimated ? estimatedQuote : finalQuote
    setIsEstimated(estimated)
    setValues(initValues(quote))
    setVariantSel(initVariantSel(quote, variantGroups))
    setNotes(quote?.notes ?? '')
    setError(null)
    setSaved(false)
  }

  function toggle(itemId: string) {
    setSaved(false)
    setValues((prev) => ({ ...prev, [itemId]: prev[itemId] === '1' ? '0' : '1' }))
  }

  function setVal(itemId: string, value: string) {
    setSaved(false)
    setValues((prev) => {
      const next = { ...prev, [itemId]: value }

      if (isEstimated && plantRatios) {
        const { frontBedIds, rearBedIds, frontPlantIds, rearPlantIds } = plantCalcIds
        const isBedItem = frontBedIds.includes(itemId) || rearBedIds.includes(itemId)
        if (isBedItem) {
          const allPlantIds = [...Object.values(frontPlantIds), ...Object.values(rearPlantIds)]
          const allEmpty = allPlantIds.every((id) => !next[id] || next[id] === '' || next[id] === '0')
          if (allEmpty) {
            Object.assign(next, computePlantValues(next))
          }
        }
      }

      return next
    })
  }

  function selectVariant(groupName: string, itemId: string) {
    setSaved(false)
    setVariantSel((prev) => ({ ...prev, [groupName]: itemId }))
  }

  function getItemQty(item: TemplateItem): number | null {
    if (item.unit === 'ITEM') return 1
    if (item.unit === 'toggle') return values[item.id] === '1' ? 1 : 0
    const m = item.auto_calc_formula?.match(/^variant_group:(.+)$/)
    if (m) {
      if (variantSel[m[1]] !== item.id) return null
      const v = values[item.id]
      return v !== undefined && v !== '' ? parseFloat(v) : null
    }
    const v = values[item.id]
    return v !== undefined && v !== '' ? parseFloat(v) : null
  }

  function handleSave(submitStatus: 'draft' | 'submitted') {
    setError(null)
    setSaved(false)

    const items: QuoteItemPayload[] = allItems.map((item) => {
      const qty = getItemQty(item)
      return {
        template_item_id:    item.id,
        item_name:           item.name,
        unit:                item.unit,
        quantity:            qty === null || isNaN(qty) ? null : qty,
        unit_price_snapshot: item.unit_price ?? null,
      }
    })

    startTransition(async () => {
      const result = await saveLotQuote({
        lotId, siteId, stageId, isEstimated,
        status: submitStatus,
        notes,
        items,
      })
      if (result?.error) setError(result.error)
      else setSaved(true)
    })
  }

  const currentStatus = activeQuote?.status ?? 'draft'
  const isApproved    = currentStatus === 'approved'
  const disabled      = isApproved || !canManage

  const colClass = isAdmin
    ? 'grid-cols-[1fr_100px_80px_80px]'
    : 'grid-cols-[1fr_100px]'

  return (
    <div className="space-y-4">

      {/* Outer show/hide toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
      >
        <svg
          className={`h-4 w-4 text-stone-400 transition-transform ${open ? '' : '-rotate-90'}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
        {open ? 'Hide Quantities' : 'Show Quantities'}
      </button>

      {open && (<>

      {/* Estimate / Final toggle */}
      <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1 self-start w-fit">
        {(['Estimate', 'Final'] as const).map((label) => {
          const est = label === 'Estimate'
          return (
            <button
              key={label}
              type="button"
              onClick={() => switchMode(est)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isEstimated === est
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Recalculate plants button — estimate mode only */}
      {isEstimated && plantRatios && !disabled && (
        <button
          type="button"
          onClick={recalculatePlants}
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
        >
          Recalculate plants from garden bed
        </button>
      )}

      {/* Status badge */}
      {activeQuote && (
        <div>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            currentStatus === 'approved'  ? 'bg-green-100 text-green-700' :
            currentStatus === 'submitted' ? 'bg-blue-100 text-blue-700'   :
            'bg-stone-100 text-stone-600'
          }`}>
            {currentStatus === 'approved' ? 'Approved' :
             currentStatus === 'submitted' ? 'Submitted' : 'Draft'}
          </span>
        </div>
      )}

      {/* Sections */}
      {sections.map((section) => {
        if (!showClientExtras && section.isClientExtra) return null
        return (
        <div key={section.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">

          {/* Section header */}
          <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
            <h3 className="text-sm font-semibold text-stone-700">{section.name}</h3>
          </div>

          {/* Column headers */}
          <div className={`grid gap-3 px-4 py-2 border-b border-stone-100 text-xs font-medium text-stone-400 ${colClass}`}>
            <span>Item</span>
            <span className="text-right">Qty</span>
            {isAdmin && <><span className="text-right">$/unit</span><span className="text-right">Total</span></>}
          </div>

          {/* Items */}
          {section.items.map((item) => {
            // Skip secondary variant items (rendered as part of the primary)
            if (secondaryIds.has(item.id)) return null

            const formula    = item.auto_calc_formula
            const variantM   = formula?.match(/^variant_group:(.+)$/)
            const groupName  = variantM?.[1]

            // Hide show_if_corner_lot items when corner lot is NO
            if (formula === 'show_if_corner_lot' && !isCornerLot) return null

            // ── Variant group ────────────────────────────────────────────────
            if (groupName) {
              const group      = variantGroups.get(groupName) ?? []
              const prefix     = commonPrefix(group.map((i) => i.name))
              const selectedId = variantSel[groupName] ?? group[0]?.id
              const selItem    = group.find((i) => i.id === selectedId) ?? group[0]
              const qtyVal     = values[selectedId] ?? ''
              const resolvedQty = parseFloat(qtyVal || '0') || 0
              const lineTotal  = isAdmin && selItem?.unit_price != null
                ? resolvedQty * selItem.unit_price
                : null

              return (
                <div key={item.id} className={`grid gap-3 px-4 py-3 border-b border-stone-100 items-start ${colClass}`}>
                  <div className="min-w-0 space-y-1.5">
                    <span className="text-sm text-stone-800">{prefix || item.name}</span>
                    <div className="flex flex-wrap gap-1">
                      {group.map((gi) => {
                        const label = prefix ? gi.name.slice(prefix.length).trim() : gi.name
                        return (
                          <button
                            key={gi.id}
                            type="button"
                            onClick={() => selectVariant(groupName, gi.id)}
                            disabled={disabled}
                            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                              selectedId === gi.id
                                ? 'bg-green-700 text-white'
                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            } disabled:opacity-50`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end items-center gap-1 pt-0.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={qtyVal}
                      onChange={(e) => setVal(selectedId, e.target.value)}
                      disabled={disabled}
                      placeholder="0"
                      className="w-16 rounded-lg border border-stone-300 px-2 py-2 text-sm text-right tabular-nums focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:bg-stone-50 disabled:text-stone-400"
                    />
                    <span className="text-xs text-stone-400 shrink-0">No.</span>
                  </div>

                  {isAdmin && (
                    <>
                      <div className="text-right text-sm text-stone-500 tabular-nums pt-0.5">
                        {selItem?.unit_price != null
                          ? `$${selItem.unit_price.toFixed(2)}`
                          : <span className="text-stone-300">—</span>}
                      </div>
                      <div className="text-right text-sm font-medium text-stone-700 tabular-nums pt-0.5">
                        {lineTotal != null
                          ? `$${lineTotal.toFixed(2)}`
                          : <span className="text-stone-300">—</span>}
                      </div>
                    </>
                  )}
                </div>
              )
            }

            // ── ITEM (always included, no input) ────────────────────────────
            if (item.unit === 'ITEM') {
              const lineTotal = isAdmin && item.unit_price != null ? item.unit_price : null
              return (
                <div key={item.id} className={`grid gap-3 px-4 py-3 border-b border-stone-100 items-center ${colClass}`}>
                  <span className="text-sm text-stone-800">{item.name}</span>
                  <div className="flex justify-end">
                    <span className="text-xs font-medium text-green-600">✓ Included</span>
                  </div>
                  {isAdmin && (
                    <>
                      <div className="text-right text-sm text-stone-500 tabular-nums">
                        {item.unit_price != null
                          ? `$${item.unit_price.toFixed(2)}`
                          : <span className="text-stone-300">—</span>}
                      </div>
                      <div className="text-right text-sm font-medium text-stone-700 tabular-nums">
                        {lineTotal != null
                          ? `$${lineTotal.toFixed(2)}`
                          : <span className="text-stone-300">—</span>}
                      </div>
                    </>
                  )}
                </div>
              )
            }

            // ── Toggle (YES / NO) ───────────────────────────────────────────
            if (item.unit === 'toggle') {
              const isYes    = values[item.id] === '1'
              const lineTotal = isAdmin && isYes && item.unit_price != null && item.unit_price > 0
                ? item.unit_price
                : null
              return (
                <div key={item.id} className={`grid gap-3 px-4 py-3 border-b border-stone-100 items-center ${colClass}`}>
                  <div className="min-w-0">
                    <span className="text-sm text-stone-800">{item.name}</span>
                    {formula === 'corner_lot_flag' && (
                      <span className="ml-1.5 text-xs text-stone-400">— controls corner lot items</span>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      disabled={disabled}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        isYes ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
                      } disabled:opacity-50`}
                    >
                      {isYes ? 'YES' : 'NO'}
                    </button>
                  </div>
                  {isAdmin && (
                    <>
                      <div className="text-right text-sm text-stone-500 tabular-nums">
                        {item.unit_price != null && item.unit_price > 0
                          ? `$${item.unit_price.toFixed(2)}`
                          : <span className="text-stone-300">—</span>}
                      </div>
                      <div className="text-right text-sm font-medium text-stone-700 tabular-nums">
                        {lineTotal != null
                          ? `$${lineTotal.toFixed(2)}`
                          : <span className="text-stone-300">—</span>}
                      </div>
                    </>
                  )}
                </div>
              )
            }

            // ── Numeric input ───────────────────────────────────────────────
            const resolvedQty = parseFloat(values[item.id] || '0') || 0
            const lineTotal   = isAdmin && item.unit_price != null
              ? resolvedQty * item.unit_price
              : null

            return (
              <div key={item.id} className={`grid gap-3 px-4 py-3 border-b border-stone-100 items-center ${colClass}`}>
                <span className="text-sm text-stone-800">{item.name}</span>
                <div className="flex justify-end items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={values[item.id] ?? ''}
                    onChange={(e) => setVal(item.id, e.target.value)}
                    disabled={disabled}
                    placeholder="0"
                    className="w-16 rounded-lg border border-stone-300 px-2 py-2 text-sm text-right tabular-nums focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:bg-stone-50 disabled:text-stone-400"
                  />
                  <span className="text-xs text-stone-400 shrink-0">{item.unit}</span>
                </div>
                {isAdmin && (
                  <>
                    <div className="text-right text-sm text-stone-500 tabular-nums">
                      {item.unit_price != null
                        ? `$${item.unit_price.toFixed(2)}`
                        : <span className="text-stone-300">—</span>}
                    </div>
                    <div className="text-right text-sm font-medium text-stone-700 tabular-nums">
                      {lineTotal != null && lineTotal > 0
                        ? `$${lineTotal.toFixed(2)}`
                        : <span className="text-stone-300">—</span>}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
        )
      })}

      {/* Admin: grand total */}
      {isAdmin && (() => {
        let grandTotal = 0
        for (const item of allItems) {
          if (!showClientExtras && item.isClientExtra) continue
          if (item.unit_price == null) continue
          const qty = getItemQty(item)
          if (qty == null || isNaN(qty)) continue
          grandTotal += qty * item.unit_price
        }
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

      </>)}
    </div>
  )
}
