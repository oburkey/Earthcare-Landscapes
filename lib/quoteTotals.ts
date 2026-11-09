// Sales quote totals (/quotes) — shared by the quote builder and its PDFs and
// by the Invoices page's "Quoted amount" for extra jobs converted from a
// quote, so the two can never disagree.

type QuoteTotalLine = { qty: number; rate: number }
type QuoteTotalSection = {
  items: QuoteTotalLine[]
  overrideSubtotal?: number | null
  excludeFromTotal?: boolean
}

export function calcItemsTotal(items: QuoteTotalLine[]): number {
  return items.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0)
}

export function calcSectionSubtotal(section: QuoteTotalSection): number {
  return section.overrideSubtotal ?? calcItemsTotal(section.items)
}

// `overrideTotal` wins outright when set; otherwise it's the sum of each
// included section's subtotal (which itself may be overridden) — optional
// sections below the total never count.
export function calcGrandTotal(sections: QuoteTotalSection[], overrideTotal?: number | null): number {
  if (overrideTotal != null) return overrideTotal
  return sections.reduce((sum, s) => (s.excludeFromTotal ? sum : sum + calcSectionSubtotal(s)), 0)
}
