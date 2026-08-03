// Plain data shared between orders-actions.ts (a 'use server' module, which
// per Next.js's Server Actions rules may only export async functions) and
// client components like StockTab.tsx that need the actual arrays at runtime.

export const STOCK_GROUPS = ['Plants', 'Mulch', 'Hardscape', 'Retic'] as const
export type StockGroup = typeof STOCK_GROUPS[number]

// Primary order item category -> the material_types.name it adds stock to
// on delivery. Categories with no entry here (currently 'Mulch' and 'Other')
// don't affect stock — Mulch materials are manual-entry-only per business
// decision (no automatic deduction from either quant sheets or deliveries).
// '35 Litre' -> Feature Trees 45L is a "closest match" guess — same
// heuristic used for the site_stock -> site_stock_items data migration;
// admins can correct via the Settings tab or by editing site stock directly.
export const ORDER_CATEGORY_TO_MATERIAL_NAME: Partial<Record<string, string>> = {
  '140mm':          '130/140mm plants',
  '200mm':          '200mm plants',
  '300mm':          '300mm plants',
  '35 Litre':       'Feature Trees 45L',
  '90 Litre':       'Feature Trees 90L',
  'Edging':         'Edging',
  'Turf':           'Turf',
  'Drippers/Retic': 'Drippers',
}
