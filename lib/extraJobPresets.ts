// Quick-add preset definitions for the Extra Job line items table. Kept in a
// plain module (not the 'use server' pricing-actions.ts) because a "use
// server" file may only export async functions — exporting these constants
// from there breaks the production build.

export const TEMPLATE_PRESET_ITEM_NAMES: Record<string, string> = {
  mulch_limestone:      'Mulch Limestone 32mm',
  mulch_black:          'Black Mulch',
  mulch_laterite:       'Laterite compacted gravel',
  mulch_recycled_brick: 'Recycled Brick',
  edging:               'Steel Edging',
  turf:                 'Artificial Turf',
}

// `itemName` is the exact quote_template_items.name — it's what gets saved
// as the line's description (not the shorter `label`), so quick-added mulch
// lines still match the materials planning page's name-based lookups
// (see app/(app)/materials/lib.ts FRONT_BED_ITEMS / REAR_BED_ITEMS).
export const MULCH_PRESET_OPTIONS = [
  { key: 'mulch_limestone',      label: 'Limestone 32mm', itemName: TEMPLATE_PRESET_ITEM_NAMES.mulch_limestone },
  { key: 'mulch_black',          label: 'Black Mulch',    itemName: TEMPLATE_PRESET_ITEM_NAMES.mulch_black },
  { key: 'mulch_laterite',       label: 'Laterite',       itemName: TEMPLATE_PRESET_ITEM_NAMES.mulch_laterite },
  { key: 'mulch_recycled_brick', label: 'Recycled Brick', itemName: TEMPLATE_PRESET_ITEM_NAMES.mulch_recycled_brick },
] as const
