// Plain data shared between orders-actions.ts / settings-actions.ts (both
// 'use server' modules, which per Next.js's Server Actions rules may only
// export async functions — a value export like these arrays resolves to
// undefined when imported into a client component across that boundary) and
// client components like OrdersTab.tsx / SettingsTab.tsx that need the
// actual arrays at runtime.

// Primary category — pot size / material type. This is what drives the
// site_stock auto-update on delivery (see CATEGORY_TO_STOCK_FIELD below).
export const ORDER_ITEM_CATEGORIES = [
  '140mm', '200mm', '300mm', '35 Litre', '90 Litre',
  'Mulch', 'Edging', 'Turf', 'Drippers/Retic', 'Other',
] as const

// Secondary plant type/variety — shown only for the plant-size categories
// above. Info only: never affects stock. More varieties can be added per
// size later without touching the primary category list.
export const PLANT_TYPE_OPTIONS: Record<string, readonly string[]> = {
  '140mm':    ['Small Shrubs', 'Medium Shrubs', 'Ground Covers', 'Strappy/Grasses', 'Hedging'],
  '200mm':    ['Small Shrubs', 'Medium Shrubs', 'Ground Covers', 'Strappy/Grasses', 'Hedging'],
  '300mm':    ['Small Shrubs', 'Medium Shrubs', 'Ground Covers', 'Strappy/Grasses', 'Hedging'],
  '35 Litre': ['Citrus Tree', 'Feature Tree'],
  '90 Litre': ['Citrus Tree', 'Feature Tree'],
}

// Units shared between order line items and material conversion settings
// ("unit from" / "unit to") so quantities line up when stock auto-updates.
export const MATERIAL_UNITS = [
  'plants', 'tonnes', 'rolls', 'packs', 'linear metres (lm)', 'm²', 'm³', 'items', 'bags', 'pallets',
] as const

export const ORDER_STATUSES = ['draft', 'ordered', 'on_hold', 'delivered'] as const
export type OrderStatus = typeof ORDER_STATUSES[number]

export const ATTACHMENT_TYPES = ['invoice', 'photo', 'document'] as const
export type AttachmentType = typeof ATTACHMENT_TYPES[number]

// Looks up the admin-configured default unit price for a category (matched
// against a conversion setting's name, e.g. 'Mulch', 'Turf'). Used to
// pre-fill a new order line item's unit price — the user can still override
// it. Takes a minimal structural shape (not the full ConversionSettingRow
// type) to avoid a circular import with SettingsTab.tsx.
export function defaultPriceForCategory(
  category: string,
  conversionSettings: readonly { name: string; default_unit_price?: number | null }[]
): number | null {
  return conversionSettings.find((cs) => cs.name === category)?.default_unit_price ?? null
}
