'use client'

import { useOptimistic, useState, useTransition } from 'react'
import {
  saveQuote, deleteQuote, getStagesForSite, convertQuoteToExtraJob,
  reorderQuoteSections, reorderQuoteLineItems,
} from './actions'
import { LOGO_DATA_URL } from '@/lib/pdfAssets'

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuoteLineItem = {
  id?: string
  description: string
  qty: number
  unit: string
  rate: number
  orderIndex: number
}

export type QuoteSection = {
  id?: string
  name: string
  orderIndex: number
  items: QuoteLineItem[]
}

export type QuoteRow = {
  id: string
  siteId: string | null
  siteName: string | null
  stageId: string | null
  stageName: string | null
  reference: string
  description: string
  status: 'draft' | 'sent' | 'accepted'
  sections: QuoteSection[]
  notes: string
  createdAt: string
}

export type SiteOption = {
  id: string
  name: string
}

export type ConversionInfo = {
  extraJobId: string
  stageName: string
  siteId: string
  stageId: string
}

export type ConversionMap = Record<string, ConversionInfo>

type Filter = 'all' | 'draft' | 'sent' | 'accepted'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcItemsTotal(items: QuoteLineItem[]): number {
  return items.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0)
}

function calcSectionSubtotal(section: QuoteSection): number {
  return calcItemsTotal(section.items)
}

function calcGrandTotal(sections: QuoteSection[]): number {
  return sections.reduce((sum, s) => sum + calcSectionSubtotal(s), 0)
}

function statusLabel(s: string): string {
  if (s === 'accepted') return 'Accepted'
  if (s === 'sent') return 'Sent'
  return 'Draft'
}

function statusClass(s: string): string {
  if (s === 'accepted') return 'bg-accent-dim text-accent-fg'
  if (s === 'sent') return 'bg-blue-100 text-blue-700'
  return 'bg-surface-raised text-fg-muted'
}

function slug(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((p) => p != null && p !== '')
    .map((p) => String(p).trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .join('-') || 'Quote'
}

function emptyLine(orderIndex: number): QuoteLineItem {
  return { description: '', qty: 1, unit: 'hr', rate: 0, orderIndex }
}

function emptySection(orderIndex: number): QuoteSection {
  return { name: '', orderIndex, items: [emptyLine(0)] }
}

// Renumbers orderIndex to match array position — called after any
// add/remove/reorder so persisted order always matches display order.
function reindex<T extends { orderIndex: number }>(arr: T[]): T[] {
  return arr.map((item, i) => ({ ...item, orderIndex: i }))
}

// Swaps two adjacent-by-position entries and reindexes — used by the ↑/↓
// reorder buttons. Only the two swapped entries actually change orderIndex.
function swapAndReindex<T extends { orderIndex: number }>(arr: T[], i: number, j: number): T[] {
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return reindex(next)
}

// ── PDF ───────────────────────────────────────────────────────────────────────

const QUOTE_STYLES = `
<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: white; }
.html2pdf__container .quote-page { padding: 38px 32px 48px; }
.html2pdf__container .hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; padding-bottom: 14px; border-bottom: 2px solid #111; }
.html2pdf__container .hdr-left .label { font-size: 20px; font-weight: bold; letter-spacing: 0.03em; margin-bottom: 8px; }
.html2pdf__container .hdr-left .site { font-size: 13px; font-weight: bold; margin-bottom: 3px; }
.html2pdf__container .hdr-left .ref { font-size: 11px; font-weight: bold; color: #222; margin: 2px 0; }
.html2pdf__container .hdr-left .sub { font-size: 10px; color: #555; margin-top: 2px; }
.html2pdf__container .hdr-right img { max-width: 130px; max-height: 55px; object-fit: contain; display: block; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container thead th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 8px; border-bottom: 2px solid #bbb; text-align: left; white-space: nowrap; }
.html2pdf__container thead th.r { text-align: right; }
.html2pdf__container td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
.html2pdf__container td.r { text-align: right; white-space: nowrap; }
.html2pdf__container td.n { color: #888; font-size: 10px; white-space: nowrap; }
.html2pdf__container tr.sec td { background: #f5f5f5; font-weight: 600; padding-top: 8px; padding-bottom: 8px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
.html2pdf__container tr.subtotal td { background: #fafafa; font-weight: 600; padding-top: 8px; padding-bottom: 8px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
.html2pdf__container tr.subtotal .gst-breakdown { font-weight: 500; font-size: 9px; color: #555; white-space: nowrap; }
.html2pdf__container tr.grand td { background: #f0f0f0; font-weight: bold; font-size: 12px; border-top: 3px solid #999; padding: 11px 8px; }
.html2pdf__container tr.grand .gst-breakdown { font-size: 10px; color: #555; font-weight: 500; white-space: nowrap; }
.html2pdf__container .quote-notes { margin-top: 18px; padding: 10px 12px; background: #f9f9f9; border: 1px solid #e8e8e8; font-size: 10px; color: #444; white-space: pre-wrap; line-height: 1.5; }
.html2pdf__container .quote-notes .notes-lbl { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #888; letter-spacing: 0.05em; margin-bottom: 4px; }
.html2pdf__container .note { margin-top: 20px; font-size: 9px; color: #999; }
</style>`

// Renders an amount cell for a subtotal / grand-total row — a plain figure
// when GST is excluded, or a compact "Ex GST / GST / Inc GST" inline
// breakdown (still one cell, not a separate row) when included.
function gstAwareAmountCell(exGst: number, includeGst: boolean): string {
  if (!includeGst) return fmt(exGst)
  const gst = exGst * 0.1
  const incGst = exGst + gst
  return `<span class="gst-breakdown">Ex GST ${fmt(exGst)} · GST ${fmt(gst)} · Inc GST ${fmt(incGst)}</span>`
}

// Section header is only rendered when the section has an explicit name —
// unnamed sections show their items with no header row. The subtotal row
// sits after the last item (not inline with the header) and only appears
// when the quote has 2+ sections (a single section's subtotal would just
// duplicate the grand total).
function quoteSectionRows(section: QuoteSection, includeGst: boolean, showSubtotal: boolean): string {
  const subtotal = calcSectionSubtotal(section)
  const rows = section.items.map((item, i) => {
    const lineTotal = (item.qty || 0) * (item.rate || 0)
    return `
      <tr>
        <td class="n">${i + 1}</td>
        <td>${item.description || ''}</td>
        <td class="r">${item.qty != null ? item.qty : ''}</td>
        <td>${item.unit || ''}</td>
        <td class="r">${item.rate > 0 ? fmt(item.rate) : '—'}</td>
        <td class="r">${lineTotal > 0 ? fmt(lineTotal) : '—'}</td>
      </tr>`
  }).join('')
  const header = section.name.trim() ? `<tr class="sec"><td colspan="6">${section.name}</td></tr>` : ''
  const subtotalRow = showSubtotal
    ? `<tr class="subtotal"><td colspan="5">Subtotal</td><td class="r">${gstAwareAmountCell(subtotal, includeGst)}</td></tr>`
    : ''
  return `
    ${header}
    ${rows || '<tr><td colspan="6" style="color:#aaa;font-style:italic;padding:6px">No line items</td></tr>'}
    ${subtotalRow}`
}

export function buildQuoteHtml(
  siteName: string | null,
  reference: string,
  description: string,
  sections: QuoteSection[],
  notes: string,
  logoSrc: string,
  includeGst: boolean
): string {
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const grandTotal = calcGrandTotal(sections)
  const showSectionSubtotals = sections.length >= 2

  const rows = sections.map((s) => quoteSectionRows(s, includeGst, showSectionSubtotals)).join('')

  return `${QUOTE_STYLES}
<div class="quote-page">
  <div class="hdr">
    <div class="hdr-left">
      <div class="label">Quote</div>
      ${siteName ? `<div class="site">${siteName}</div>` : ''}
      ${reference ? `<div class="ref">${reference}</div>` : ''}
      ${description ? `<div class="sub">${description}</div>` : ''}
      <div class="sub">${date}</div>
    </div>
    <div class="hdr-right">
      ${logoSrc ? `<img src="${logoSrc}" alt="Earthcare Landscapes" />` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th class="r">Qty</th>
        <th>Unit</th>
        <th class="r">Rate</th>
        <th class="r">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="color:#aaa;font-style:italic;padding:6px">No sections</td></tr>'}
      <tr class="grand">
        <td colspan="5">Total (ex GST)</td>
        <td class="r">${gstAwareAmountCell(grandTotal, includeGst)}</td>
      </tr>
    </tbody>
  </table>
  ${notes ? `<div class="quote-notes"><div class="notes-lbl">Notes / Conditions</div>${notes.replace(/\n/g, '<br>')}</div>` : ''}
</div>`
}

// ── Combined PDF ──────────────────────────────────────────────────────────────

const COMBINED_STYLES = `
<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: white; }
.html2pdf__container .combined-page { padding: 38px 32px 48px; }
.html2pdf__container .quote-section { margin-top: 32px; padding-top: 26px; border-top: 1px solid #ddd; }
.html2pdf__container .doc-hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; padding-bottom: 14px; border-bottom: 2px solid #111; }
.html2pdf__container .doc-hdr-left .main-label { font-size: 22px; font-weight: bold; letter-spacing: 0.03em; margin-bottom: 4px; }
.html2pdf__container .doc-hdr-left .sub { font-size: 10px; color: #555; }
.html2pdf__container .doc-hdr-right img { max-width: 130px; max-height: 55px; object-fit: contain; display: block; }
.html2pdf__container .sec-hdr { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
.html2pdf__container .sec-title { font-size: 13px; font-weight: bold; color: #111; margin-bottom: 2px; }
.html2pdf__container .sec-desc { font-size: 10px; color: #555; }
.html2pdf__container .sec-notes { margin-top: 10px; padding: 8px 10px; background: #f9f9f9; border: 1px solid #e8e8e8; font-size: 10px; color: #444; white-space: pre-wrap; line-height: 1.5; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container thead th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 8px; border-bottom: 2px solid #bbb; text-align: left; white-space: nowrap; }
.html2pdf__container thead th.r { text-align: right; }
.html2pdf__container td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
.html2pdf__container td.r { text-align: right; white-space: nowrap; }
.html2pdf__container td.n { color: #888; font-size: 10px; white-space: nowrap; }
.html2pdf__container tr.sec td { background: #f5f5f5; font-weight: 600; padding-top: 8px; padding-bottom: 8px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
.html2pdf__container tr.subtotal td { background: #fafafa; font-weight: 600; padding-top: 8px; padding-bottom: 8px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
.html2pdf__container tr.grand td { background: #f0f0f0; font-weight: bold; font-size: 12px; border-top: 3px solid #999; padding: 11px 8px; }
</style>`

function buildCombinedQuotesPdf(selectedQuotes: QuoteRow[], logoSrc: string): string {
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  let grandTotal = 0

  const quoteBlocks = selectedQuotes.map((q, idx) => {
    const quoteTotal = calcGrandTotal(q.sections)
    grandTotal += quoteTotal
    const showSectionSubtotals = q.sections.length >= 2

    const sectionRows = q.sections.map((section) => {
      const subtotal = calcSectionSubtotal(section)
      const rows = section.items.map((item, i) => {
        const lineTotal = (item.qty || 0) * (item.rate || 0)
        return `
          <tr>
            <td class="n">${i + 1}</td>
            <td>${item.description || ''}</td>
            <td class="r">${item.qty != null ? item.qty : ''}</td>
            <td>${item.unit || ''}</td>
            <td class="r">${item.rate > 0 ? fmt(item.rate) : '—'}</td>
            <td class="r">${lineTotal > 0 ? fmt(lineTotal) : '—'}</td>
          </tr>`
      }).join('')
      const header = section.name.trim() ? `<tr class="sec"><td colspan="6">${section.name}</td></tr>` : ''
      const subtotalRow = showSectionSubtotals
        ? `<tr class="subtotal"><td colspan="5">Subtotal</td><td class="r">${fmt(subtotal)}</td></tr>`
        : ''
      return `
        ${header}
        ${rows}
        ${subtotalRow}`
    }).join('')

    const sectionTitle = [q.siteName, q.reference].filter(Boolean).join(' — ')

    return `<div${idx > 0 ? ' class="quote-section"' : ''}>
      ${idx === 0 ? `
        <div class="doc-hdr">
          <div class="doc-hdr-left">
            <div class="main-label">Quotes</div>
            <div class="sub">${date}</div>
          </div>
          <div class="doc-hdr-right">
            ${logoSrc ? `<img src="${logoSrc}" alt="Earthcare Landscapes" />` : ''}
          </div>
        </div>` : ''}
      <div class="sec-hdr">
        ${sectionTitle ? `<div class="sec-title">${sectionTitle}</div>` : ''}
        ${q.description ? `<div class="sec-desc">${q.description}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Description</th>
            <th class="r">Qty</th><th>Unit</th>
            <th class="r">Rate</th><th class="r">Total</th>
          </tr>
        </thead>
        <tbody>
          ${sectionRows || '<tr><td colspan="6" style="color:#aaa;font-style:italic;padding:6px">No sections</td></tr>'}
          <tr class="subtotal">
            <td colspan="5">Quote total</td>
            <td class="r">${fmt(quoteTotal)}</td>
          </tr>
        </tbody>
      </table>
      ${q.notes ? `<div class="sec-notes">${q.notes.replace(/\n/g, '<br>')}</div>` : ''}
    </div>`
  }).join('')

  return `${COMBINED_STYLES}
<div class="combined-page">
  ${quoteBlocks}
  <table style="margin-top:16px">
    <tbody>
      <tr class="grand">
        <td colspan="5">Total (ex GST)</td>
        <td class="r">${fmt(grandTotal)}</td>
      </tr>
    </tbody>
  </table>
</div>`
}

export async function downloadPDF(
  contentHtml: string,
  filename: string,
  onError: (msg: string) => void,
  onDone: () => void
) {
  const el = document.createElement('div')
  el.innerHTML = contentHtml
  try {
    const { default: html2pdf } = await import('html2pdf.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (html2pdf() as any)
      .set({
        margin:      0,
        filename,
        image:       { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:   { mode: ['css', 'legacy'] },
      })
      .from(el)
      .save()
  } catch {
    onError('Failed to generate PDF. Please try again.')
  } finally {
    onDone()
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuotesView({
  initialQuotes,
  sites,
  canEdit,
  tableExists,
  initialConversions,
}: {
  initialQuotes: QuoteRow[]
  sites: SiteOption[]
  canEdit: boolean
  tableExists: boolean
  initialConversions: ConversionMap
}) {
  const [quotes, setQuotes]     = useState<QuoteRow[]>(initialQuotes)
  const [filter, setFilter]     = useState<Filter>('all')
  // 'all' | 'unlinked' | a site id — persisted so the chosen site sticks
  // across visits. Lazy-init reads localStorage directly; since this only
  // ever affects a client-side filter (not the initial server-rendered
  // list), there's no SSR/hydration mismatch to worry about.
  const [siteFilter, setSiteFilter] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all'
    return window.localStorage.getItem('quotes.siteFilter') ?? 'all'
  })

  function handleSiteFilterChange(value: string) {
    setSiteFilter(value)
    window.localStorage.setItem('quotes.siteFilter', value)
  }

  // 'list' | 'new' | quote id being edited
  const [view, setView]         = useState<'list' | 'new' | string>('list')

  // Builder form state
  const [siteId, setSiteId]           = useState('')
  const [stageId, setStageId]         = useState('')
  const [reference, setReference]     = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus]           = useState<'draft' | 'sent' | 'accepted'>('draft')
  const [sections, setSections]       = useState<QuoteSection[]>([emptySection(0)])
  const [notes, setNotes]             = useState('')
  const [formStages, setFormStages]   = useState<{ id: string; name: string }[]>([])
  const [loadingFormStages, setLoadingFormStages] = useState(false)
  const [convertValidation, setConvertValidation] = useState(false)
  const [includeGst, setIncludeGst]   = useState(false)

  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [pdfGenerating, setPdfGenerating]   = useState(false)
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [actionError, setActionError]   = useState<string | null>(null)

  // Conversion state
  const [conversions, setConversions]         = useState<ConversionMap>(initialConversions)
  // Optimistic overlay on top of `conversions` — shows the "Converted" badge
  // instantly while the action is in flight, and (since it's read from
  // `conversions` on every render) is immune to any Server Component refresh
  // that revalidatePath() triggers in the background: the overlay reverts to
  // whatever `conversions` holds once the transition settles, and we only
  // commit `conversions` for real after the action confirms success.
  const [optimisticConversions, addOptimisticConversion] = useOptimistic(
    conversions,
    (state: ConversionMap, entry: { quoteId: string; info: ConversionInfo }) => ({
      ...state,
      [entry.quoteId]: entry.info,
    })
  )
  const [convertingQuoteId, setConvertingQuoteId] = useState<string | null>(null)
  const [convertSiteId, setConvertSiteId]     = useState('')
  const [convertStageId, setConvertStageId]   = useState('')
  const [convertStages, setConvertStages]     = useState<{ id: string; name: string }[]>([])
  const [converting, startConvertTransition]  = useTransition()
  const [convertError, setConvertError]       = useState<string | null>(null)
  const [loadingStages, setLoadingStages]     = useState(false)

  // ── Navigation ─────────────────────────────────────────────────────────────

  function openNew() {
    setSiteId(''); setStageId(''); setReference(''); setDescription('')
    setStatus('draft')
    setSections([{ name: '', orderIndex: 0, items: [{ description: 'Administration & Preliminary', qty: 1, unit: 'item', rate: 500, orderIndex: 0 }] }])
    setNotes('')
    setFormStages([]); setConvertValidation(false); setIncludeGst(false)
    setActionError(null); setView('new')
  }

  function openEdit(q: QuoteRow) {
    setSiteId(q.siteId ?? '')
    setStageId(q.stageId ?? '')
    setReference(q.reference)
    setDescription(q.description)
    setStatus(q.status)
    setSections(q.sections.length > 0 ? q.sections : [emptySection(0)])
    setNotes(q.notes)
    setConvertValidation(false)
    setIncludeGst(false)
    setActionError(null)
    setView(q.id)
    if (q.siteId) {
      fetchFormStages(q.siteId)
    } else {
      setFormStages([])
    }
  }

  function closeBuilder() {
    setView('list'); setActionError(null)
  }

  // ── Section / line item helpers ─────────────────────────────────────────────

  function addSection() {
    setSections((prev) => reindex([...prev, emptySection(0)]))
  }

  function removeSection(sectionIdx: number) {
    setSections((prev) => {
      if (prev.length <= 1) return prev
      if (!confirm('Remove this section and its line items?')) return prev
      return reindex(prev.filter((_, idx) => idx !== sectionIdx))
    })
  }

  function renameSection(sectionIdx: number, name: string) {
    setSections((prev) => prev.map((s, idx) => idx === sectionIdx ? { ...s, name } : s))
  }

  function addLine(sectionIdx: number) {
    setSections((prev) => prev.map((s, idx) =>
      idx === sectionIdx ? { ...s, items: reindex([...s.items, emptyLine(0)]) } : s
    ))
  }

  function removeLine(sectionIdx: number, itemIdx: number) {
    setSections((prev) => prev.map((s, idx) => {
      if (idx !== sectionIdx || s.items.length <= 1) return s
      return { ...s, items: reindex(s.items.filter((_, i) => i !== itemIdx)) }
    }))
  }

  // Reorder — always reorders local state instantly; the DB write only
  // fires when the moved rows already exist (quote saved at least once and
  // both swapped rows have an id). New/unsaved quotes and sections/items
  // added this session stay local-only until the next "Save quote".
  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    const reordered = swapAndReindex(sections, index, target)
    setSections(reordered)
    if (view !== 'new') {
      setQuotes((prev) => prev.map((q) => (q.id === view ? { ...q, sections: reordered } : q)))
    }
    const a = reordered[index], b = reordered[target]
    if (view !== 'new' && a.id && b.id) {
      reorderQuoteSections([{ id: a.id, orderIndex: a.orderIndex }, { id: b.id, orderIndex: b.orderIndex }])
        .then((result) => { if (result?.error) setActionError(result.error) })
        .catch(() => setActionError('Failed to save the new section order.'))
    }
  }

  function moveItem(sectionIdx: number, itemIdx: number, direction: -1 | 1) {
    const section = sections[sectionIdx]
    const target = itemIdx + direction
    if (target < 0 || target >= section.items.length) return
    const reorderedItems = swapAndReindex(section.items, itemIdx, target)
    const reorderedSections = sections.map((s, idx) => (idx === sectionIdx ? { ...s, items: reorderedItems } : s))
    setSections(reorderedSections)
    if (view !== 'new') {
      setQuotes((prev) => prev.map((q) => (q.id === view ? { ...q, sections: reorderedSections } : q)))
    }
    const a = reorderedItems[itemIdx], b = reorderedItems[target]
    if (view !== 'new' && a.id && b.id) {
      reorderQuoteLineItems([{ id: a.id, orderIndex: a.orderIndex }, { id: b.id, orderIndex: b.orderIndex }])
        .then((result) => { if (result?.error) setActionError(result.error) })
        .catch(() => setActionError('Failed to save the new item order.'))
    }
  }

  function updateLine<K extends keyof QuoteLineItem>(sectionIdx: number, itemIdx: number, key: K, value: QuoteLineItem[K]) {
    setSections((prev) => prev.map((s, idx) => {
      if (idx !== sectionIdx) return s
      return { ...s, items: s.items.map((item, i) => i === itemIdx ? { ...item, [key]: value } : item) }
    }))
  }

  function addPreset(desc: string, rate: number) {
    setSections((prev) => {
      if (prev.length === 0) return prev
      const lastIdx = prev.length - 1
      return prev.map((s, idx) =>
        idx === lastIdx ? { ...s, items: reindex([...s.items, { description: desc, qty: 1, unit: 'hr', rate, orderIndex: 0 }]) } : s
      )
    })
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setActionError(null)

    const fd = new FormData()
    if (view !== 'new' && view !== 'list') fd.set('id', view)
    fd.set('site_id', siteId)
    fd.set('stage_id', stageId)
    fd.set('reference', reference)
    fd.set('description', description)
    fd.set('status', status)
    fd.set('sections', JSON.stringify(sections))
    fd.set('notes', notes)

    const result = await saveQuote(fd)
    setSaving(false)

    if (result && 'error' in result) {
      setActionError(result.error)
      return
    }

    const resolvedSiteName = sites.find((s) => s.id === siteId)?.name ?? null
    const resolvedStageName = formStages.find((s) => s.id === stageId)?.name ?? null

    if (view === 'new') {
      const newId = ('id' in (result ?? {})) ? (result as { id: string }).id : crypto.randomUUID()
      setQuotes((prev) => [
        { id: newId, siteId: siteId || null, siteName: resolvedSiteName, stageId: stageId || null, stageName: resolvedStageName, reference, description, status, sections, notes, createdAt: new Date().toISOString() },
        ...prev,
      ])
    } else {
      setQuotes((prev) =>
        prev.map((q) =>
          q.id === view
            ? { ...q, siteId: siteId || null, siteName: resolvedSiteName, stageId: stageId || null, stageName: resolvedStageName, reference, description, status, sections, notes }
            : q
        )
      )
    }

    closeBuilder()
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (view === 'new' || view === 'list') return
    if (!confirm('Delete this quote? This cannot be undone.')) return

    setDeleting(true)
    setActionError(null)

    const fd = new FormData()
    fd.set('id', view)

    const result = await deleteQuote(fd)
    setDeleting(false)

    if (result?.error) { setActionError(result.error); return }
    setQuotes((prev) => prev.filter((q) => q.id !== view))
    closeBuilder()
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  // ── Form stage fetching ─────────────────────────────────────────────────────

  async function fetchFormStages(sid: string) {
    if (!sid) { setFormStages([]); return }
    setLoadingFormStages(true)
    const stages = await getStagesForSite(sid)
    setFormStages(stages)
    setLoadingFormStages(false)
  }

  function handleFormSiteChange(newSiteId: string) {
    setSiteId(newSiteId)
    setStageId('')
    setConvertValidation(false)
    fetchFormStages(newSiteId)
  }

  // ── Conversion ─────────────────────────────────────────────────────────────

  async function fetchStages(sid: string) {
    if (!sid) { setConvertStages([]); return }
    setLoadingStages(true)
    const stages = await getStagesForSite(sid)
    setConvertStages(stages)
    setLoadingStages(false)
  }

  async function openConvertModal(quoteId: string, quoteSiteId: string, quoteStageId: string) {
    setConvertingQuoteId(quoteId)
    setConvertSiteId(quoteSiteId)
    setConvertStageId(quoteStageId)
    setConvertError(null)
    fetchStages(quoteSiteId)
  }

  async function handleSiteChangeForConvert(newSiteId: string) {
    setConvertSiteId(newSiteId)
    setConvertStageId('')
    fetchStages(newSiteId)
  }

  function handleConvert() {
    if (!convertingQuoteId || !convertStageId || !convertSiteId) return
    const quoteId       = convertingQuoteId
    const targetStageId = convertStageId
    const targetSiteId  = convertSiteId
    const targetStageName = convertStages.find((s) => s.id === targetStageId)?.name ?? ''

    setConvertError(null)

    startConvertTransition(async () => {
      // Shows the "Converted" badge immediately; reverts automatically if the
      // transition ends without a matching update to `conversions` (i.e. on error).
      addOptimisticConversion({
        quoteId,
        info: { extraJobId: '', stageName: targetStageName, siteId: targetSiteId, stageId: targetStageId },
      })

      let result: Awaited<ReturnType<typeof convertQuoteToExtraJob>>
      try {
        const fd = new FormData()
        fd.set('quote_id', quoteId)
        fd.set('stage_id', targetStageId)
        fd.set('site_id', targetSiteId)
        result = await convertQuoteToExtraJob(fd)
      } catch {
        setConvertError('Failed to convert quote. Please try again.')
        return
      }

      if ('error' in result) {
        setConvertError(result.error)
        return
      }

      setConversions((prev) => ({
        ...prev,
        [quoteId]: {
          extraJobId: result.extraJobId,
          stageName:  result.stageName,
          siteId:     result.siteId,
          stageId:    result.stageId,
        },
      }))
      setConvertingQuoteId(null)
    })
  }

  function handleExportCombined() {
    const ordered = quotes.filter((q) => selectedIds.has(q.id))
    if (ordered.length === 0) return
    const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
      .replace(/ /g, '-')
    const filename = `Earthcare-Quotes-${dateStr}.pdf`
    const html = buildCombinedQuotesPdf(ordered, LOGO_DATA_URL)
    setBatchGenerating(true)
    downloadPDF(html, filename, setActionError, () => setBatchGenerating(false))
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  function handleDownloadPDF() {
    const resolvedSiteName = sites.find((s) => s.id === siteId)?.name ?? null
    const filename = slug(resolvedSiteName, reference || 'Quote') + '.pdf'
    const html = buildQuoteHtml(resolvedSiteName, reference, description, sections, notes, LOGO_DATA_URL, includeGst)
    setPdfGenerating(true)
    downloadPDF(html, filename, setActionError, () => setPdfGenerating(false))
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  const grandTotal = calcGrandTotal(sections)

  // ── Builder view ───────────────────────────────────────────────────────────

  if (view !== 'list') {
    const isNew = view === 'new'

    return (
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={closeBuilder}
            className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Quotes
          </button>
          <span className="text-fg-muted">/</span>
          <h1 className="text-xl font-semibold text-fg">{isNew ? 'New quote' : 'Edit quote'}</h1>
          {!isNew && (
            <>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </>
          )}
        </div>

        {/* Form card */}
        <div className="rounded-xl border border-border bg-surface p-5 space-y-5">

          {/* Site + Stage + Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={`text-xs font-semibold uppercase tracking-wide ${convertValidation && !siteId ? 'text-red-500' : 'text-fg-secondary'}`}>Site</label>
              <select
                value={siteId}
                onChange={(e) => handleFormSiteChange(e.target.value)}
                className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg focus:outline-none ${
                  convertValidation && !siteId ? 'border-red-400 focus:border-red-500' : 'border-border focus:border-border'
                }`}
              >
                <option value="">— No site —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={`text-xs font-semibold uppercase tracking-wide ${convertValidation && !stageId ? 'text-red-500' : 'text-fg-secondary'}`}>Stage</label>
              <select
                value={stageId}
                onChange={(e) => { setStageId(e.target.value); setConvertValidation(false) }}
                disabled={!siteId || loadingFormStages}
                className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg focus:outline-none disabled:opacity-50 ${
                  convertValidation && !stageId ? 'border-red-400 focus:border-red-500' : 'border-border focus:border-border'
                }`}
              >
                <option value="">
                  {!siteId ? '— Select site first —' : loadingFormStages ? 'Loading…' : formStages.length === 0 ? '— No stages —' : '— No stage —'}
                </option>
                {formStages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. Lot 104, TL#121, Vibe"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none"
              />
            </div>
          </div>
          {convertValidation && (!siteId || !stageId) && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Please select a site and stage before converting.
            </p>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Client extras — rear turf and edging"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none"
            />
          </div>

          {/* Sections */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Sections</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addPreset('Bobcat', 90)}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-raised transition-colors"
                >
                  + Bobcat $90/hr
                </button>
                <button
                  type="button"
                  onClick={() => addPreset('Labour', 65)}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-raised transition-colors"
                >
                  + Labour $65/hr
                </button>
              </div>
            </div>

            {sections.map((section, sIdx) => {
              const sectionSubtotal = calcSectionSubtotal(section)
              const showSubtotal = sections.length >= 2
              return (
                <div key={sIdx} className="rounded-lg border border-border-subtle overflow-hidden">
                  {/* Section header — name only */}
                  <div className="flex items-center gap-2 bg-surface-raised px-3 py-2">
                    <input
                      type="text"
                      value={section.name}
                      onChange={(e) => renameSection(sIdx, e.target.value)}
                      placeholder="Section name (optional)"
                      className="flex-1 rounded border border-border bg-surface px-2 py-1 text-sm font-medium text-fg placeholder:text-fg-muted focus:border-border focus:outline-none"
                    />
                    <MoveButtons
                      onUp={() => moveSection(sIdx, -1)}
                      onDown={() => moveSection(sIdx, 1)}
                      disabledUp={sIdx === 0}
                      disabledDown={sIdx === sections.length - 1}
                    />
                    <button
                      type="button"
                      onClick={() => removeSection(sIdx)}
                      disabled={sections.length === 1}
                      className="shrink-0 text-fg-muted hover:text-red-500 disabled:opacity-40 disabled:hover:text-fg-muted transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left text-xs font-semibold text-fg-secondary uppercase tracking-wide pb-2 pr-3 min-w-[180px]">Description</th>
                            <th className="text-right text-xs font-semibold text-fg-secondary uppercase tracking-wide pb-2 px-2 w-20">Qty</th>
                            <th className="text-left text-xs font-semibold text-fg-secondary uppercase tracking-wide pb-2 px-2 w-20">Unit</th>
                            <th className="text-right text-xs font-semibold text-fg-secondary uppercase tracking-wide pb-2 px-2 w-24">Rate</th>
                            <th className="text-right text-xs font-semibold text-fg-secondary uppercase tracking-wide pb-2 px-2 w-28">Total</th>
                            <th className="pb-2 w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.items.map((item, i) => {
                            const lineTotal = (item.qty || 0) * (item.rate || 0)
                            return (
                              <tr key={i} className="border-b border-border-subtle">
                                <td className="py-1.5 pr-3">
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => updateLine(sIdx, i, 'description', e.target.value)}
                                    placeholder="Description"
                                    className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none"
                                  />
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="number"
                                    value={item.qty}
                                    min={0}
                                    step="any"
                                    onChange={(e) => updateLine(sIdx, i, 'qty', parseFloat(e.target.value) || 0)}
                                    className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg text-right focus:border-border focus:outline-none"
                                  />
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    value={item.unit}
                                    onChange={(e) => updateLine(sIdx, i, 'unit', e.target.value)}
                                    placeholder="hr"
                                    className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none"
                                  />
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="number"
                                    value={item.rate}
                                    min={0}
                                    step="any"
                                    onChange={(e) => updateLine(sIdx, i, 'rate', parseFloat(e.target.value) || 0)}
                                    className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg text-right focus:border-border focus:outline-none"
                                  />
                                </td>
                                <td className="py-1.5 px-2 text-right text-sm tabular-nums text-fg-secondary">
                                  {fmt(lineTotal)}
                                </td>
                                <td className="py-1.5 pl-2">
                                  <div className="flex items-center gap-1">
                                    <MoveButtons
                                      onUp={() => moveItem(sIdx, i, -1)}
                                      onDown={() => moveItem(sIdx, i, 1)}
                                      disabledUp={i === 0}
                                      disabledDown={i === section.items.length - 1}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeLine(sIdx, i)}
                                      disabled={section.items.length === 1}
                                      className="text-fg-muted hover:text-red-500 disabled:hover:text-fg-muted transition-colors"
                                    >
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {showSubtotal && (
                      <div className="flex justify-end border-t border-border-subtle pt-2">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-fg-muted">Subtotal</span>
                          <span className="font-semibold tabular-nums text-fg-secondary">{fmt(sectionSubtotal)}</span>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => addLine(sIdx)}
                      className="flex items-center gap-1 text-sm font-medium text-accent-fg hover:text-green-900 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add line
                    </button>
                  </div>
                </div>
              )
            })}

            <button
              type="button"
              onClick={addSection}
              className="flex items-center gap-1 text-sm font-medium text-accent-fg hover:text-green-900 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add section
            </button>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Notes / Conditions</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Quote valid for 30 days. Price subject to site access."
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-none"
            />
          </div>

          {/* Totals */}
          <div className="flex justify-end border-t border-border-subtle pt-4">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between font-semibold text-fg">
                <span>Total (ex GST)</span>
                <span className="tabular-nums">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Status toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Status</label>
            <div className="flex gap-2">
              {(['draft', 'sent', 'accepted'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    status === s
                      ? s === 'accepted' ? 'bg-green-600 text-white'
                        : s === 'sent'   ? 'bg-blue-600 text-white'
                        :                  'bg-stone-700 text-white'
                      : 'bg-surface-raised text-fg-muted hover:bg-border'
                  }`}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </div>

          {actionError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
          )}
        </div>

        {/* Conversion indicator (edit view) */}
        {!isNew && optimisticConversions[view] && (
          <a
            href={`/sites/${optimisticConversions[view].siteId}/stages/${optimisticConversions[view].stageId}`}
            className="flex items-center gap-2 rounded-xl border border-green-200 bg-accent-dim px-4 py-3 text-sm text-accent-fg hover:bg-accent-dim transition-colors"
          >
            <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Converted to extra job &mdash; {optimisticConversions[view].stageName}</span>
            <svg className="h-3.5 w-3.5 shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving…' : 'Save quote'}
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={pdfGenerating}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-60 transition-colors"
          >
            {pdfGenerating ? <Spinner /> : <PdfIcon />}
            {pdfGenerating ? 'Generating…' : 'Download PDF'}
          </button>
          <label className="flex items-center gap-1.5 text-sm text-fg-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeGst}
              onChange={(e) => setIncludeGst(e.target.checked)}
              className="h-4 w-4 rounded border-border text-accent-fg focus:ring-green-600 cursor-pointer"
            />
            Include GST
          </label>
          {!isNew && status === 'accepted' && !optimisticConversions[view] && canEdit && (
            <button
              type="button"
              onClick={() => openConvertModal(view, siteId || '', stageId || '')}
              className="flex items-center gap-2 rounded-lg border border-green-200 bg-accent-dim px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-dim transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-3L16.5 18m0 0L12 13.5m4.5 4.5V4.5" />
              </svg>
              Convert to extra job
            </button>
          )}
          <button
            type="button"
            onClick={closeBuilder}
            className="text-sm text-fg-muted hover:text-fg-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────

  const filtered = quotes
    .filter((q) => filter === 'all' || q.status === filter)
    .filter((q) => {
      if (siteFilter === 'all') return true
      if (siteFilter === 'unlinked') return !q.siteId
      return q.siteId === siteFilter
    })

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-fg">Quotes</h1>
        {canEdit && (
          <button
            type="button"
            onClick={openNew}
            className="rounded-lg bg-green-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900 transition-colors"
          >
            New quote
          </button>
        )}
      </div>

      {/* Site filter */}
      <div className="flex justify-start">
        <select
          value={siteFilter}
          onChange={(e) => handleSiteFilterChange(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-border focus:outline-none"
        >
          <option value="all">All sites</option>
          <option value="unlinked">Unlinked</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Table-not-found banner */}
      {!tableExists && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The quotes table hasn&apos;t been created yet. Run the SQL migration to enable this feature.
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(['all', 'draft', 'sent', 'accepted'] as const).map((f) => {
          const count = f === 'all' ? quotes.length : quotes.filter((q) => q.status === f).length
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f
                  ? f === 'all' ? 'bg-stone-900 text-white' : 'bg-green-700 text-white'
                  : 'text-fg-muted hover:bg-surface-raised'
              }`}
            >
              {f === 'all' ? 'All' : statusLabel(f)}
              <span className={`ml-1.5 text-xs ${filter === f ? 'text-fg-muted' : 'text-fg-muted'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Quote list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-16 text-center">
          <p className="text-sm font-medium text-fg-muted">No quotes{filter !== 'all' ? ` with status "${statusLabel(filter)}"` : ''}</p>
          {canEdit && filter === 'all' && (
            <p className="mt-1 text-sm text-fg-muted">
              Click <span className="font-medium">New quote</span> to get started.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
          {filtered.map((q) => {
            const rowSubtotal = calcGrandTotal(q.sections)
            const date = new Date(q.createdAt).toLocaleDateString('en-AU', {
              day: 'numeric', month: 'short', year: 'numeric',
            })
            const selected = selectedIds.has(q.id)
            const conv = optimisticConversions[q.id]
            return (
              <div
                key={q.id}
                className={`px-5 py-4 transition-colors ${selected ? 'bg-accent-dim' : 'hover:bg-surface-raised'}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelection(q.id)}
                    className="h-4 w-4 rounded border-border text-accent-fg focus:ring-green-600 cursor-pointer shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => openEdit(q)}
                    className="flex flex-1 items-center gap-4 text-left min-w-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {q.reference && (
                          <span className="font-semibold text-fg text-sm">{q.reference}</span>
                        )}
                        {q.siteName && (
                          <span className="text-xs text-fg-muted">{q.siteName}</span>
                        )}
                        {!q.reference && !q.siteName && (
                          <span className="text-sm text-fg-muted italic">Untitled</span>
                        )}
                      </div>
                      {q.description && (
                        <p className="text-sm text-fg-muted mt-0.5 truncate">{q.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-fg-muted shrink-0 hidden sm:block">{date}</span>
                    <span className="text-sm tabular-nums font-semibold text-fg shrink-0">{fmt(rowSubtotal)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${statusClass(q.status)}`}>
                      {statusLabel(q.status)}
                    </span>
                  </button>
                </div>
                {conv && (
                  <a
                    href={`/sites/${conv.siteId}/stages/${conv.stageId}`}
                    className="ml-10 mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent-dim border border-green-200 px-2.5 py-0.5 text-xs font-medium text-accent-fg hover:bg-accent-dim transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Converted to extra job &mdash; {conv.stageName}
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sticky action bar — appears when quotes are selected */}
      {selectedIds.size > 0 && (
        <div className="sticky top-14 md:top-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-accent-dim px-4 py-2.5">
          <span className="text-sm font-medium text-accent-fg">
            {selectedIds.size} quote{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportCombined}
              disabled={batchGenerating}
              className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-60 transition-colors"
            >
              {batchGenerating ? <Spinner /> : <PdfIcon />}
              {batchGenerating ? 'Generating…' : 'Export combined PDF'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-accent-fg hover:text-green-900 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}

      {/* Conversion modal */}
      {convertingQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-fg">Convert to extra job</h2>
            <p className="text-sm text-fg-muted">
              This will create a new extra job on the selected stage with the quote&apos;s line items copied as pricing estimates.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Site</label>
              <select
                value={convertSiteId}
                onChange={(e) => handleSiteChangeForConvert(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-border focus:outline-none"
              >
                <option value="">— Select site —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Stage</label>
              <select
                value={convertStageId}
                onChange={(e) => setConvertStageId(e.target.value)}
                disabled={!convertSiteId || loadingStages}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-border focus:outline-none disabled:opacity-50"
              >
                <option value="">
                  {!convertSiteId ? '— Select a site first —' : loadingStages ? 'Loading stages…' : convertStages.length === 0 ? '— No stages found —' : '— Select stage —'}
                </option>
                {convertStages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {convertError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{convertError}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleConvert}
                disabled={converting || !convertStageId}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60 transition-colors"
              >
                {converting ? 'Converting…' : 'Convert'}
              </button>
              <button
                type="button"
                onClick={() => { setConvertingQuoteId(null); setConvertError(null) }}
                className="text-sm text-fg-muted hover:text-fg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MoveButtons({
  onUp, onDown, disabledUp, disabledDown,
}: {
  onUp: () => void
  onDown: () => void
  disabledUp: boolean
  disabledDown: boolean
}) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={onUp}
        disabled={disabledUp}
        aria-label="Move up"
        className="text-fg-muted hover:text-fg-secondary disabled:opacity-30 disabled:hover:text-fg-muted transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disabledDown}
        aria-label="Move down"
        className="text-fg-muted hover:text-fg-secondary disabled:opacity-30 disabled:hover:text-fg-muted transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
  )
}

function PdfIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
