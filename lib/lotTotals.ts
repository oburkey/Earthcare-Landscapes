// The one billing rule for a lot's invoice total. Every place that shows or
// stores a lot total (invoices page, claim sheet PDFs, Approved panel, invoice
// snapshots, stage summary, Excel export) must go through this.
//
// - Contract-priced lots: Total = contract price only. Client extras on the
//   Final quant sheet are never added on top.
// - Other lots: Final standard (Providence Works) + client extras.
// - No contract price and no Final quant sheet: no total (null) — the
//   Estimate is never substituted in.

export interface LotTotalInput {
  contractPrice: number | null
  hasFinal: boolean
  standardAmount: number
  clientExtrasAmount: number
}

export function lotInvoiceTotal(lot: LotTotalInput): number | null {
  if (lot.contractPrice != null) return lot.contractPrice
  if (lot.hasFinal) return lot.standardAmount + lot.clientExtrasAmount
  return null
}

// Client extras that are actually billed — always 0 on a contract-priced lot.
export function billedClientExtras(lot: LotTotalInput): number {
  return lot.contractPrice != null ? 0 : lot.clientExtrasAmount
}
