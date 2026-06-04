'use client'

import { useState } from 'react'
import { saveQuote, deleteQuote } from './actions'
import { LOGO_DATA_URL } from '@/lib/pdfAssets'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LineItem = {
  description: string
  qty: number
  unit: string
  rate: number
}

export type QuoteRow = {
  id: string
  siteId: string | null
  siteName: string | null
  reference: string
  description: string
  status: 'draft' | 'sent' | 'accepted'
  lineItems: LineItem[]
  notes: string
  createdAt: string
}

export type SiteOption = {
  id: string
  name: string
}

type Filter = 'all' | 'draft' | 'sent' | 'accepted'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcSubtotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + (item.qty || 0) * (item.rate || 0), 0)
}

function statusLabel(s: string): string {
  if (s === 'accepted') return 'Accepted'
  if (s === 'sent') return 'Sent'
  return 'Draft'
}

function statusClass(s: string): string {
  if (s === 'accepted') return 'bg-green-100 text-green-700'
  if (s === 'sent') return 'bg-blue-100 text-blue-700'
  return 'bg-stone-100 text-stone-500'
}

function slug(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((p) => p != null && p !== '')
    .map((p) => String(p).trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .join('-') || 'Quote'
}

function emptyLine(): LineItem {
  return { description: '', qty: 1, unit: 'hr', rate: 0 }
}

// ── PDF ───────────────────────────────────────────────────────────────────────

const QUOTE_STYLES = `
<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: white; }
.html2pdf__container .quote-page { padding: 24px 28px; }
.html2pdf__container .hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #111; }
.html2pdf__container .hdr-left .label { font-size: 20px; font-weight: bold; letter-spacing: 0.03em; margin-bottom: 8px; }
.html2pdf__container .hdr-left .site { font-size: 13px; font-weight: bold; margin-bottom: 3px; }
.html2pdf__container .hdr-left .ref { font-size: 11px; font-weight: bold; color: #222; margin: 2px 0; }
.html2pdf__container .hdr-left .sub { font-size: 10px; color: #555; margin-top: 2px; }
.html2pdf__container .hdr-right img { max-width: 130px; max-height: 55px; object-fit: contain; display: block; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container thead th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 5px 6px; border-bottom: 2px solid #bbb; text-align: left; white-space: nowrap; }
.html2pdf__container thead th.r { text-align: right; }
.html2pdf__container td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
.html2pdf__container td.r { text-align: right; white-space: nowrap; }
.html2pdf__container td.n { color: #888; font-size: 10px; white-space: nowrap; }
.html2pdf__container tr.sub td { background: #fafafa; font-weight: 600; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
.html2pdf__container tr.gst td { background: #fafafa; }
.html2pdf__container tr.grand td { background: #f0f0f0; font-weight: bold; font-size: 12px; border-top: 3px solid #999; padding: 7px 6px; }
.html2pdf__container .quote-notes { margin-top: 12px; padding: 8px 10px; background: #f9f9f9; border: 1px solid #e8e8e8; font-size: 10px; color: #444; white-space: pre-wrap; line-height: 1.5; }
.html2pdf__container .quote-notes .notes-lbl { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #888; letter-spacing: 0.05em; margin-bottom: 4px; }
.html2pdf__container .note { margin-top: 14px; font-size: 9px; color: #999; }
</style>`

function buildQuoteHtml(
  siteName: string | null,
  reference: string,
  description: string,
  lineItems: LineItem[],
  notes: string,
  logoSrc: string
): string {
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const subtotal = calcSubtotal(lineItems)
  const gst   = subtotal * 0.1
  const total = subtotal + gst

  const rows = lineItems.map((item, i) => {
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
        <th class="r">Total (ex GST)</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="color:#aaa;font-style:italic;padding:6px">No line items</td></tr>'}
      <tr class="sub">
        <td colspan="5">Subtotal (ex GST)</td>
        <td class="r">${fmt(subtotal)}</td>
      </tr>
      <tr class="gst">
        <td colspan="5">GST (10%)</td>
        <td class="r">${fmt(gst)}</td>
      </tr>
      <tr class="grand">
        <td colspan="5">Total (inc GST)</td>
        <td class="r">${fmt(total)}</td>
      </tr>
    </tbody>
  </table>
  ${notes ? `<div class="quote-notes"><div class="notes-lbl">Notes / Conditions</div>${notes.replace(/\n/g, '<br>')}</div>` : ''}
  <div class="note">Rates and line totals are exclusive of GST unless otherwise noted.</div>
</div>`
}

// ── Combined PDF ──────────────────────────────────────────────────────────────

const COMBINED_STYLES = `
<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: white; }
.html2pdf__container .combined-page { padding: 24px 28px; }
.html2pdf__container .quote-section { margin-top: 24px; padding-top: 20px; border-top: 1px solid #ddd; }
.html2pdf__container .doc-hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #111; }
.html2pdf__container .doc-hdr-left .main-label { font-size: 22px; font-weight: bold; letter-spacing: 0.03em; margin-bottom: 4px; }
.html2pdf__container .doc-hdr-left .sub { font-size: 10px; color: #555; }
.html2pdf__container .doc-hdr-right img { max-width: 130px; max-height: 55px; object-fit: contain; display: block; }
.html2pdf__container .sec-hdr { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ddd; }
.html2pdf__container .sec-title { font-size: 13px; font-weight: bold; color: #111; margin-bottom: 2px; }
.html2pdf__container .sec-desc { font-size: 10px; color: #555; }
.html2pdf__container .sec-notes { margin-top: 8px; padding: 6px 8px; background: #f9f9f9; border: 1px solid #e8e8e8; font-size: 10px; color: #444; white-space: pre-wrap; line-height: 1.5; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container thead th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 5px 6px; border-bottom: 2px solid #bbb; text-align: left; white-space: nowrap; }
.html2pdf__container thead th.r { text-align: right; }
.html2pdf__container td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
.html2pdf__container td.r { text-align: right; white-space: nowrap; }
.html2pdf__container td.n { color: #888; font-size: 10px; white-space: nowrap; }
.html2pdf__container tr.sub td { background: #fafafa; font-weight: 600; border-top: 1px solid #ddd; border-bottom: 2px solid #ccc; }
.html2pdf__container tr.grand td { background: #f0f0f0; font-weight: bold; font-size: 12px; border-top: 3px solid #999; padding: 7px 6px; }
.html2pdf__container .note { margin-top: 14px; font-size: 9px; color: #999; }
</style>`

function buildCombinedQuotesPdf(selectedQuotes: QuoteRow[], logoSrc: string): string {
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  let grandTotal = 0

  const sections = selectedQuotes.map((q, idx) => {
    const subtotal = calcSubtotal(q.lineItems)
    grandTotal += subtotal

    const rows = q.lineItems.map((item, i) => {
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
            <th class="r">Rate</th><th class="r">Total (ex GST)</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" style="color:#aaa;font-style:italic;padding:6px">No line items</td></tr>'}
          <tr class="sub">
            <td colspan="5">Subtotal (ex GST)</td>
            <td class="r">${fmt(subtotal)}</td>
          </tr>
        </tbody>
      </table>
      ${q.notes ? `<div class="sec-notes">${q.notes.replace(/\n/g, '<br>')}</div>` : ''}
    </div>`
  }).join('')

  return `${COMBINED_STYLES}
<div class="combined-page">
  ${sections}
  <table style="margin-top:16px">
    <tbody>
      <tr class="grand">
        <td colspan="5">Grand Total (ex GST)</td>
        <td class="r">${fmt(grandTotal)}</td>
      </tr>
    </tbody>
  </table>
  <div class="note">Rates and line totals are exclusive of GST unless otherwise noted.</div>
</div>`
}

async function downloadPDF(
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
}: {
  initialQuotes: QuoteRow[]
  sites: SiteOption[]
  canEdit: boolean
  tableExists: boolean
}) {
  const [quotes, setQuotes]     = useState<QuoteRow[]>(initialQuotes)
  const [filter, setFilter]     = useState<Filter>('all')

  // 'list' | 'new' | quote id being edited
  const [view, setView]         = useState<'list' | 'new' | string>('list')

  // Builder form state
  const [siteId, setSiteId]           = useState('')
  const [reference, setReference]     = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus]           = useState<'draft' | 'sent' | 'accepted'>('draft')
  const [lineItems, setLineItems]     = useState<LineItem[]>([emptyLine()])
  const [notes, setNotes]             = useState('')

  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [pdfGenerating, setPdfGenerating]   = useState(false)
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [actionError, setActionError]   = useState<string | null>(null)

  // ── Navigation ─────────────────────────────────────────────────────────────

  function openNew() {
    setSiteId(''); setReference(''); setDescription('')
    setStatus('draft'); setLineItems([{ description: 'Administration & Preliminary', qty: 1, unit: 'item', rate: 500 }]); setNotes('')
    setActionError(null); setView('new')
  }

  function openEdit(q: QuoteRow) {
    setSiteId(q.siteId ?? '')
    setReference(q.reference)
    setDescription(q.description)
    setStatus(q.status)
    setLineItems(q.lineItems.length > 0 ? q.lineItems : [emptyLine()])
    setNotes(q.notes)
    setActionError(null)
    setView(q.id)
  }

  function closeBuilder() {
    setView('list'); setActionError(null)
  }

  // ── Line item helpers ──────────────────────────────────────────────────────

  function addLine() {
    setLineItems((prev) => [...prev, emptyLine()])
  }

  function removeLine(i: number) {
    setLineItems((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)
  }

  function updateLine<K extends keyof LineItem>(i: number, key: K, value: LineItem[K]) {
    setLineItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [key]: value } : item))
  }

  function addPreset(desc: string, rate: number) {
    setLineItems((prev) => [...prev, { description: desc, qty: 1, unit: 'hr', rate }])
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setActionError(null)

    const fd = new FormData()
    if (view !== 'new' && view !== 'list') fd.set('id', view)
    fd.set('site_id', siteId)
    fd.set('reference', reference)
    fd.set('description', description)
    fd.set('status', status)
    fd.set('line_items', JSON.stringify(lineItems))
    fd.set('notes', notes)

    const result = await saveQuote(fd)
    setSaving(false)

    if (result && 'error' in result) {
      setActionError(result.error)
      return
    }

    const resolvedSiteName = sites.find((s) => s.id === siteId)?.name ?? null

    if (view === 'new') {
      const newId = ('id' in (result ?? {})) ? (result as { id: string }).id : crypto.randomUUID()
      setQuotes((prev) => [
        { id: newId, siteId: siteId || null, siteName: resolvedSiteName, reference, description, status, lineItems, notes, createdAt: new Date().toISOString() },
        ...prev,
      ])
    } else {
      setQuotes((prev) =>
        prev.map((q) =>
          q.id === view
            ? { ...q, siteId: siteId || null, siteName: resolvedSiteName, reference, description, status, lineItems, notes }
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
    const html = buildQuoteHtml(resolvedSiteName, reference, description, lineItems, notes, LOGO_DATA_URL)
    setPdfGenerating(true)
    downloadPDF(html, filename, setActionError, () => setPdfGenerating(false))
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  const subtotal = calcSubtotal(lineItems)
  const gst   = subtotal * 0.1
  const total = subtotal + gst

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
            className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Quotes
          </button>
          <span className="text-stone-300">/</span>
          <h1 className="text-xl font-semibold text-stone-900">{isNew ? 'New quote' : 'Edit quote'}</h1>
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
        <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-5">

          {/* Site + Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Site</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-400 focus:outline-none"
              >
                <option value="">— No site —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. Lot 104, TL#121, Vibe"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Client extras — rear turf and edging"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
            />
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Line Items</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addPreset('Bobcat', 90)}
                  className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  + Bobcat $90/hr
                </button>
                <button
                  type="button"
                  onClick={() => addPreset('Labour', 65)}
                  className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  + Labour $65/hr
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 pr-3 min-w-[180px]">Description</th>
                    <th className="text-right text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 px-2 w-20">Qty</th>
                    <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 px-2 w-20">Unit</th>
                    <th className="text-right text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 px-2 w-24">Rate</th>
                    <th className="text-right text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 px-2 w-28">Total</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, i) => {
                    const lineTotal = (item.qty || 0) * (item.rate || 0)
                    return (
                      <tr key={i} className="border-b border-stone-100">
                        <td className="py-1.5 pr-3">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLine(i, 'description', e.target.value)}
                            placeholder="Description"
                            className="w-full rounded border border-stone-200 px-2 py-1 text-sm focus:border-stone-400 focus:outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            value={item.qty}
                            min={0}
                            step="any"
                            onChange={(e) => updateLine(i, 'qty', parseFloat(e.target.value) || 0)}
                            className="w-full rounded border border-stone-200 px-2 py-1 text-sm text-right focus:border-stone-400 focus:outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => updateLine(i, 'unit', e.target.value)}
                            placeholder="hr"
                            className="w-full rounded border border-stone-200 px-2 py-1 text-sm focus:border-stone-400 focus:outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            value={item.rate}
                            min={0}
                            step="any"
                            onChange={(e) => updateLine(i, 'rate', parseFloat(e.target.value) || 0)}
                            className="w-full rounded border border-stone-200 px-2 py-1 text-sm text-right focus:border-stone-400 focus:outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right text-sm tabular-nums text-stone-700">
                          {fmt(lineTotal)}
                        </td>
                        <td className="py-1.5 pl-2">
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            disabled={lineItems.length === 1}
                            className="text-stone-300 hover:text-red-500 disabled:hover:text-stone-300 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-900 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add line
            </button>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Notes / Conditions</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Quote valid for 30 days. Price subject to site access."
              rows={3}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none resize-none"
            />
          </div>

          {/* Totals */}
          <div className="flex justify-end border-t border-stone-100 pt-4">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal (ex GST)</span>
                <span className="tabular-nums">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>GST (10%)</span>
                <span className="tabular-nums">{fmt(gst)}</span>
              </div>
              <div className="flex justify-between font-semibold text-stone-900 border-t border-stone-200 pt-1.5">
                <span>Total (inc GST)</span>
                <span className="tabular-nums">{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Status toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Status</label>
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
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
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
            className="flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60 transition-colors"
          >
            {pdfGenerating ? <Spinner /> : <PdfIcon />}
            {pdfGenerating ? 'Generating…' : 'Download PDF'}
          </button>
          <button
            type="button"
            onClick={closeBuilder}
            className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────

  const filtered = quotes.filter((q) => filter === 'all' || q.status === filter)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-stone-900">Quotes</h1>
        {canEdit && (
          <button
            type="button"
            onClick={openNew}
            className="rounded-lg bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
          >
            New quote
          </button>
        )}
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
                filter === f ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              {f === 'all' ? 'All' : statusLabel(f)}
              <span className={`ml-1.5 text-xs ${filter === f ? 'text-stone-300' : 'text-stone-400'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Quote list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-16 text-center">
          <p className="text-sm font-medium text-stone-600">No quotes{filter !== 'all' ? ` with status "${statusLabel(filter)}"` : ''}</p>
          {canEdit && filter === 'all' && (
            <p className="mt-1 text-sm text-stone-400">
              Click <span className="font-medium">New quote</span> to get started.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
          {filtered.map((q) => {
            const rowSubtotal = calcSubtotal(q.lineItems)
            const date = new Date(q.createdAt).toLocaleDateString('en-AU', {
              day: 'numeric', month: 'short', year: 'numeric',
            })
            const selected = selectedIds.has(q.id)
            return (
              <div
                key={q.id}
                className={`flex items-center gap-3 px-5 py-4 transition-colors ${selected ? 'bg-green-50' : 'hover:bg-stone-50'}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleSelection(q.id)}
                  className="h-4 w-4 rounded border-stone-300 text-green-700 focus:ring-green-600 cursor-pointer shrink-0"
                />
                <button
                  type="button"
                  onClick={() => openEdit(q)}
                  className="flex flex-1 items-center gap-4 text-left min-w-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {q.reference && (
                        <span className="font-semibold text-stone-900 text-sm">{q.reference}</span>
                      )}
                      {q.siteName && (
                        <span className="text-xs text-stone-400">{q.siteName}</span>
                      )}
                      {!q.reference && !q.siteName && (
                        <span className="text-sm text-stone-400 italic">Untitled</span>
                      )}
                    </div>
                    {q.description && (
                      <p className="text-sm text-stone-500 mt-0.5 truncate">{q.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-stone-400 shrink-0 hidden sm:block">{date}</span>
                  <span className="text-sm tabular-nums font-semibold text-stone-900 shrink-0">{fmt(rowSubtotal)}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${statusClass(q.status)}`}>
                    {statusLabel(q.status)}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Sticky action bar — appears when quotes are selected */}
      {selectedIds.size > 0 && (
        <div className="sticky top-14 md:top-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5">
          <span className="text-sm font-medium text-green-800">
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
              className="text-xs text-green-700 hover:text-green-900 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}
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
