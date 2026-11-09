// Shared shape of an extra job's line items as the line items table shows
// them — used by the extra job page on load and by the save action, which
// sends the saved lines (with their ids) straight back to the table.

export const EXTRA_JOB_LINES_SELECT =
  'id, template_item_id, description, unit, quantity, unit_price, item_type, sort_order, quote_template_items(name, unit_price)'

export type ExtraJobLine = {
  id: string
  description: string
  qty: number | null
  unit: string
  rate: number | null
}

type LineRow = {
  id: string
  description: string | null
  unit: string
  quantity: number | null
  unit_price: number | null
  item_type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote_template_items?: any
}

// Rates are only included for admins.
export function toExtraJobLines(rows: LineRow[], isAdmin: boolean): ExtraJobLine[] {
  return rows.map((i) => {
    const tplRaw = i.quote_template_items
    const tpl = Array.isArray(tplRaw) ? tplRaw[0] : tplRaw
    // Old quant-sheet rows stored template items by reference with no
    // description of their own — resolve the name from the template
    // so existing extra jobs still display correctly as line items.
    const description = i.item_type === 'template'
      ? (tpl?.name ?? i.description ?? '')
      : (i.description ?? '')
    const resolvedRate = i.unit_price !== null
      ? Number(i.unit_price)
      : (tpl?.unit_price != null ? Number(tpl.unit_price) : null)
    return {
      id:          i.id,
      description,
      qty:         i.quantity !== null ? Number(i.quantity) : null,
      unit:        i.unit,
      rate:        isAdmin ? resolvedRate : null,
    }
  })
}
