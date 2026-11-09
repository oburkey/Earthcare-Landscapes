// Shared shape of an extra job's sections and line items as the line items
// table shows them — used by the extra job page on load and by the save
// action, which sends the saved sections (with their ids) straight back to
// the table.

export const EXTRA_JOB_LINES_SELECT =
  'id, section_id, template_item_id, description, unit, quantity, unit_price, item_type, sort_order, quote_template_items(name, unit_price)'

export const EXTRA_JOB_SECTIONS_SELECT = 'id, name, sort_order'

export type ExtraJobLine = {
  id: string
  description: string
  qty: number | null
  unit: string
  rate: number | null
}

export type ExtraJobSection = {
  // null only for the fallback section holding lines with no section_id
  id: string | null
  name: string
  lines: ExtraJobLine[]
}

type LineRow = {
  id: string
  section_id?: string | null
  description: string | null
  unit: string
  quantity: number | null
  unit_price: number | null
  item_type: string
  sort_order: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote_template_items?: any
}

type SectionRow = {
  id: string
  name: string | null
  sort_order: number
}

// Rates are only included for admins.
function toExtraJobLine(i: LineRow, isAdmin: boolean): ExtraJobLine {
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
}

// Groups lines into their sections, both in saved order. A line with no
// (or an unknown) section_id — e.g. inserted by an old browser tab — goes
// into an unnamed section at the top, so it's never hidden.
export function toExtraJobSections(sectionRows: SectionRow[], lineRows: LineRow[], isAdmin: boolean): ExtraJobSection[] {
  const sections: ExtraJobSection[] = [...sectionRows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ id: s.id, name: s.name ?? '', lines: [] }))
  const byId = new Map(sections.map((s) => [s.id, s]))
  const orphans: ExtraJobLine[] = []

  for (const row of [...lineRows].sort((a, b) => a.sort_order - b.sort_order)) {
    const section = row.section_id ? byId.get(row.section_id) : undefined
    if (section) section.lines.push(toExtraJobLine(row, isAdmin))
    else orphans.push(toExtraJobLine(row, isAdmin))
  }

  if (orphans.length > 0) sections.unshift({ id: null, name: '', lines: orphans })
  return sections
}

// For PDFs: an extra job's priced items split into runs of the same section,
// in order. `sectioned` is false when no section has a name — the PDF then
// prints the plain list exactly as before sections existed.
export function sectionGroups<T>(
  items: T[],
  sectionIdOf: (item: T) => string | null,
  sectionNameOf: (item: T) => string,
): { sectioned: boolean; groups: { name: string; items: T[] }[] } {
  const groups: { id: string | null; name: string; items: T[] }[] = []
  for (const item of items) {
    const id = sectionIdOf(item)
    const last = groups[groups.length - 1]
    if (last && last.id === id) last.items.push(item)
    else groups.push({ id, name: sectionNameOf(item).trim(), items: [item] })
  }
  return { sectioned: groups.some((g) => g.name !== ''), groups }
}
