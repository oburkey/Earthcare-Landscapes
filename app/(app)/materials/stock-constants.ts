// Plain data shared between stock-actions.ts (a 'use server' module, which
// per Next.js's Server Actions rules may only export async functions) and
// client components like StockTab.tsx that need the actual array at runtime.

export const STOCK_FIELDS = [
  'plants_140mm', 'plants_200mm', 'plants_300mm', 'plants_35l', 'plants_90l',
  'mulch_tonnes', 'edging_metres', 'turf_rolls', 'drippers_packs',
] as const
export type StockField = typeof STOCK_FIELDS[number]

// Primary order item category -> the site_stock column it adds to on
// delivery. Categories with no entry here (currently just 'Other') don't
// affect stock.
export const CATEGORY_TO_STOCK_FIELD: Partial<Record<string, StockField>> = {
  '140mm':          'plants_140mm',
  '200mm':          'plants_200mm',
  '300mm':          'plants_300mm',
  '35 Litre':       'plants_35l',
  '90 Litre':       'plants_90l',
  'Mulch':          'mulch_tonnes',
  'Edging':         'edging_metres',
  'Turf':           'turf_rolls',
  'Drippers/Retic': 'drippers_packs',
}
