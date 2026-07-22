// Plain data shared between orders-actions.ts (a 'use server' module, which
// per Next.js's Server Actions rules may only export async functions — a
// value export like this array resolves to undefined when imported into a
// client component across that boundary) and client components like
// OrdersTab.tsx that need the actual array at runtime.

export const ORDER_ITEM_CATEGORIES = [
  'Small Shrubs', 'Medium Shrubs', 'Ground Covers', 'Strappy/Grasses',
  'Hedging', 'Trees', 'Mulch', 'Edging', 'Turf', 'Drippers', 'Other',
] as const
