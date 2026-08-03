// Shared, server-only helpers for writing to site_stock_items — used by both
// quote-actions.ts (final quant sheet -> stock deduction) and
// orders-actions.ts (delivered order -> stock addition). No 'use server'
// directive: this is never called directly from a client, only imported by
// other 'use server' modules, so it's free to export plain values/functions.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type MaterialTypeRow = {
  id: string
  name: string
  unit: string
  stockGroup: string
  quantItemNames: string[]
  conversionRate: number | null
}

type QuoteItem = { item_name: string; quantity: number | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logStockError(context: string, error: any, extra?: Record<string, unknown>) {
  console.error(`[materials/stock-deduction] ${context}:`, {
    message: error?.message, code: error?.code, details: error?.details, hint: error?.hint,
    ...extra,
  })
}

// Active material types, with each one's linked conversion rate (via
// conversion_setting_id — Turf's rolls-per-m² rate, Drippers'/Jabs'
// units-per-pack rate if configured, etc.) resolved alongside. Returns []
// on failure rather than throwing — callers should treat a missing
// material type list as "nothing to do", not a hard error.
export async function getActiveMaterialTypes(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<MaterialTypeRow[]> {
  const { data, error } = await supabase
    .from('material_types')
    .select('id, name, unit, stock_group, quant_item_names, material_conversion_settings(conversion_rate)')
    .eq('is_active', true)

  if (error || !data) {
    logStockError('getActiveMaterialTypes', error)
    return []
  }

  return data.map((m) => {
    const conv = Array.isArray(m.material_conversion_settings)
      ? m.material_conversion_settings[0]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (m.material_conversion_settings as any)
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      stockGroup: m.stock_group,
      quantItemNames: m.quant_item_names ?? [],
      conversionRate: conv?.conversion_rate != null ? Number(conv.conversion_rate) : null,
    }
  })
}

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2
}

function sumByNames(items: QuoteItem[], names: string[]): number {
  if (names.length === 0) return 0
  return items
    .filter((i) => names.includes(i.item_name))
    .reduce((sum, i) => sum + (i.quantity ?? 0), 0)
}

// Material types (by stock_group) never deducted from quant sheets or order
// deliveries — Mulch is a manual-entry-only group per business decision
// (still shown/editable on the Stock tab, just never auto-adjusted).
const NO_AUTO_DEDUCTION_GROUPS = new Set(['Mulch'])

// Names of the material types whose quant_item_names, combined, represent
// "total plants" for the Retic auto-calcs below.
const PLANT_MATERIAL_NAMES = ['130/140mm plants', '200mm plants', '300mm plants']

// Computes the stock quantity change per material type between the old
// (pre-save) and new (post-save) lot_quote_items snapshots of a final quant
// sheet. Positive = add to stock (usage went down since last save),
// negative = remove from stock (usage went up). Only includes material
// types whose quantity actually changed (Poly Pipe is the one exception —
// see below, it always applies).
export function computeQuantSheetStockChanges(
  materialTypes: MaterialTypeRow[],
  oldItems: QuoteItem[],
  newItems: QuoteItem[]
): Map<string, number> {
  const changes = new Map<string, number>()
  const turf = materialTypes.find((m) => m.name === 'Turf')

  // Turf: raw m² summed from its quant_item_names, converted to rolls
  // (rounded independently on each side, to nearest 0.5) using its linked
  // conversion rate. Rounding each snapshot independently — not the delta —
  // keeps this diff consistent with whatever was actually written to stock
  // on the previous save.
  if (turf) {
    const turfOldM2 = sumByNames(oldItems, turf.quantItemNames)
    const turfNewM2 = sumByNames(newItems, turf.quantItemNames)
    if (turf.conversionRate && turf.conversionRate > 0) {
      const oldRolls = roundToHalf(turfOldM2 / turf.conversionRate)
      const newRolls = roundToHalf(turfNewM2 / turf.conversionRate)
      if (newRolls !== oldRolls) changes.set(turf.id, oldRolls - newRolls)
    } else {
      logStockError('computeQuantSheetStockChanges: Turf has no linked conversion rate — skipping Turf stock deduction', null)
    }
  }

  // Everything else with quant_item_names configured (excluding Mulch-group
  // items, which are manual-entry only — see NO_AUTO_DEDUCTION_GROUPS):
  // direct name-sum diff.
  for (const mt of materialTypes) {
    if (mt.id === turf?.id) continue
    if (NO_AUTO_DEDUCTION_GROUPS.has(mt.stockGroup)) continue
    if (mt.quantItemNames.length === 0) continue
    const oldQty = sumByNames(oldItems, mt.quantItemNames)
    const newQty = sumByNames(newItems, mt.quantItemNames)
    if (newQty !== oldQty) changes.set(mt.id, oldQty - newQty)
  }

  // Retic — Drippers & Jabs: both derive from the same total plant count
  // (130/140mm + 200mm + 300mm plants, front and rear combined — summing by
  // name naturally covers both sections since they share item names).
  // Divided by each material's own linked pack-size conversion rate if one
  // is configured, else 1:1.
  const plantItemNames = materialTypes
    .filter((m) => PLANT_MATERIAL_NAMES.includes(m.name))
    .flatMap((m) => m.quantItemNames)
  if (plantItemNames.length > 0) {
    const oldPlantTotal = sumByNames(oldItems, plantItemNames)
    const newPlantTotal = sumByNames(newItems, plantItemNames)
    for (const name of ['Drippers', 'Jabs']) {
      const mt = materialTypes.find((m) => m.name === name)
      if (!mt) continue
      const rate = mt.conversionRate && mt.conversionRate > 0 ? mt.conversionRate : 1
      const oldQty = oldPlantTotal / rate
      const newQty = newPlantTotal / rate
      if (newQty !== oldQty) changes.set(mt.id, oldQty - newQty)
    }
  }

  // Retic — Poly Pipe: fixed 1 roll, deducted only on the FIRST final quant
  // sheet save for a lot (no previous saved final quantities) — same "only
  // deduct the difference" principle as everything else here, just a
  // one-time step instead of a formula-driven diff. Re-saving an already-
  // saved final quant sheet deducts 0, not another roll.
  const polyPipe = materialTypes.find((m) => m.name === 'Poly Pipe')
  if (polyPipe) {
    const hadPreviousFinalData = oldItems.some((i) => i.quantity !== null)
    if (!hadPreviousFinalData) {
      changes.set(polyPipe.id, (changes.get(polyPipe.id) ?? 0) - 1)
    }
  }

  return changes
}

// Adjusts one site's one material's stock by `quantityChange` (positive =
// add to stock, negative = remove), clamped at 0. Creates the row at
// quantity 0 if missing — can't deduct from a material that was never
// recorded — and logs that case rather than silently doing nothing. Uses
// the admin client so the write is guaranteed to land regardless of the
// calling action's own session/role (same pattern as the pre-start
// vehicle-hours update and the original site_stock delivery write). Never
// throws — always resolves, so callers can loop over many materials without
// one failure aborting the rest.
export async function applyStockDelta(params: {
  siteId: string
  materialTypeId: string
  quantityChange: number
  source: 'manual' | 'order_delivery' | 'quant_deduction'
  updatedBy: string
  lotNumber?: string | null
}): Promise<{ ok: boolean }> {
  const { siteId, materialTypeId, quantityChange, source, updatedBy, lotNumber } = params
  if (quantityChange === 0) return { ok: true }

  const admin = createAdminClient()

  const { data: existing, error: fetchError } = await admin
    .from('site_stock_items')
    .select('quantity')
    .eq('site_id', siteId)
    .eq('material_type_id', materialTypeId)
    .maybeSingle()

  if (fetchError) {
    logStockError('applyStockDelta fetch', fetchError, { siteId, materialTypeId, quantityChange })
    return { ok: false }
  }

  if (!existing) {
    logStockError(
      'applyStockDelta: no existing site_stock_items row for this site/material — creating at 0, could not apply change',
      null,
      { siteId, materialTypeId, quantityChange }
    )
  }

  const nextQuantity = existing ? Math.max(0, Number(existing.quantity) + quantityChange) : 0

  const { error: upsertError } = await admin
    .from('site_stock_items')
    .upsert({
      site_id: siteId,
      material_type_id: materialTypeId,
      quantity: nextQuantity,
      last_updated_by: updatedBy,
      last_update_source: source,
      last_update_lot: source === 'quant_deduction' ? (lotNumber ?? null) : null,
    }, { onConflict: 'site_id,material_type_id' })

  if (upsertError) {
    logStockError('applyStockDelta upsert', upsertError, { siteId, materialTypeId, quantityChange })
    return { ok: false }
  }

  return { ok: true }
}
