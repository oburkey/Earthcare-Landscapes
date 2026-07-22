// Plain data shared between stock-actions.ts (a 'use server' module, which
// per Next.js's Server Actions rules may only export async functions) and
// client components like StockTab.tsx that need the actual array at runtime.

export const STOCK_FIELDS = [
  'plants_140mm', 'plants_200mm', 'mulch_tonnes', 'edging_metres', 'turf_rolls', 'drippers_packs',
] as const
export type StockField = typeof STOCK_FIELDS[number]
