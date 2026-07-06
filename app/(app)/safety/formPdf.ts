import { LOGO_DATA_URL } from '@/lib/pdfAssets'
import type { FormSection, SafetyFormType } from '@/types/database'

export interface FormPdfData {
  templateTitle: string
  formType: SafetyFormType
  workerName: string
  siteName: string | null
  completedAt: string
  sections: FormSection[]
  contentHtml: string | null
  requireWitness: boolean
  responses: Record<string, boolean | 'yes' | 'no' | string>
  inducteeSignatureUrl: string | null  // data URL or R2 signed URL
  witnessSignatureUrl: string | null
  notes: string | null
}

// Ensures a URL is a data URL before passing to html2canvas.
// For data: URLs: passes through immediately.
// For https: URLs (R2 signed): loads via Image with crossOrigin='anonymous' (same CORS path
// html2canvas uses), draws to an offscreen canvas, and returns the resulting data URL.
// This eliminates html2canvas's CORS dependency for the image entirely.
async function ensureDataUrl(src: string | null): Promise<string | null> {
  if (!src) return null
  if (src.startsWith('data:')) return src
  return new Promise<string | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width  = img.naturalWidth  || img.width
        c.height = img.naturalHeight || img.height
        const ctx = c.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0)
        resolve(c.toDataURL('image/png'))
      } catch {
        resolve(null) // canvas security error (CORS taint)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

const PDF_STYLES = `<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; color: #111; background: white; }
.html2pdf__container .page { padding: 20px 24px; }
.html2pdf__container .hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #222; gap: 12px; }
.html2pdf__container .hdr-left { min-width: 0; flex: 1; }
.html2pdf__container .hdr-left .brand { font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #555; margin-bottom: 4px; }
.html2pdf__container .hdr-left h1 { font-size: 15px; font-weight: bold; color: #111; margin-bottom: 5px; line-height: 1.25; }
.html2pdf__container .hdr-left .meta { font-size: 8.5px; color: #444; }
.html2pdf__container .hdr-right img { max-width: 120px; max-height: 48px; object-fit: contain; display: block; flex-shrink: 0; }
.html2pdf__container .sec-hdr { background: #f0f0f0; color: #111; border-left: 3px solid #333; padding: 5px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 12px; }
.html2pdf__container .resp-table { width: 100%; border-collapse: collapse; }
.html2pdf__container .resp-table td { padding: 4px 6px; border-bottom: 1px solid #eee; font-size: 8.5px; vertical-align: top; }
.html2pdf__container .resp-label { width: 82%; }
.html2pdf__container .resp-val { width: 18%; text-align: right; white-space: nowrap; font-weight: 600; }
.html2pdf__container .ok { color: #111; }
.html2pdf__container .bad { color: #cc0000; }
.html2pdf__container .completion-record { margin-top: 20px; padding-top: 14px; border-top: 2px solid #222; }
.html2pdf__container .completion-record h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #333; margin-bottom: 8px; letter-spacing: 0.05em; }
.html2pdf__container .completion-record .cr-meta { font-size: 8.5px; color: #333; margin-bottom: 5px; }
.html2pdf__container .notes-block { margin-top: 10px; border: 1px solid #ddd; border-radius: 2px; padding: 5px 7px; }
.html2pdf__container .notes-label { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #555; margin-bottom: 3px; }
.html2pdf__container .notes-text { font-size: 8.5px; color: #333; }
.html2pdf__container .sigs { display: flex; gap: 28px; margin-top: 14px; align-items: flex-start; }
.html2pdf__container .sig-block .sig-label { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #555; margin-bottom: 5px; letter-spacing: 0.04em; }
.html2pdf__container .sig-block img { height: 72px; border: 1px solid #ccc; padding: 3px; background: #fff; border-radius: 3px; display: block; }
.html2pdf__container .sig-block .sig-name { font-size: 8px; color: #777; margin-top: 4px; }
</style>`

function renderResponse(
  type: string,
  id: string,
  responses: Record<string, boolean | 'yes' | 'no' | string>,
): string {
  const val = responses[id]
  if (type === 'checkbox') {
    return val === true
      ? '<span class="ok">&#10003; Confirmed</span>'
      : '<span class="bad">&#10007; Not confirmed</span>'
  }
  if (type === 'yes_no') {
    if (val === 'yes') return '<span class="ok">Yes</span>'
    if (val === 'no')  return '<span class="bad">No</span>'
    return '<span style="color:#aaa">—</span>'
  }
  if (type === 'text') {
    const s = String(val ?? '').trim()
    return s || '<span style="color:#aaa">—</span>'
  }
  return '—'
}

function buildInteractiveBody(sections: FormSection[], responses: Record<string, boolean | 'yes' | 'no' | string>): string {
  return sections.map(section => {
    const rows = section.items.map(item =>
      `<tr>
        <td class="resp-label">${item.label}</td>
        <td class="resp-val">${renderResponse(item.type, item.id, responses)}</td>
      </tr>`
    ).join('')
    return `<div class="sec-hdr">${section.title}</div>
<table class="resp-table"><tbody>${rows}</tbody></table>`
  }).join('')
}

function buildSigs(
  workerName: string,
  completedAt: string,
  requireWitness: boolean,
  inducteeDataUrl: string | null,
  witnessDataUrl: string | null,
): string {
  const date = new Date(completedAt).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const inductee = inducteeDataUrl
    ? `<div class="sig-block">
        <div class="sig-label">Inductee / Worker Signature</div>
        <img src="${inducteeDataUrl}" />
        <div class="sig-name">${workerName} — ${date}</div>
       </div>`
    : ''
  const witness = requireWitness && witnessDataUrl
    ? `<div class="sig-block">
        <div class="sig-label">Witness / Safety Rep Signature</div>
        <img src="${witnessDataUrl}" />
       </div>`
    : ''
  if (!inductee && !witness) return ''
  return `<div class="sigs">${inductee}${witness}</div>`
}

function buildNotesBlock(notes: string | null): string {
  if (!notes?.trim()) return ''
  return `<div class="notes-block">
    <div class="notes-label">Notes</div>
    <div class="notes-text">${notes}</div>
  </div>`
}

function buildHtml(
  data: FormPdfData,
  inducteeDataUrl: string | null,
  witnessDataUrl: string | null,
): string {
  const date = new Date(data.completedAt).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const siteStr = data.siteName ? ` &nbsp;·&nbsp; Site: <strong>${data.siteName}</strong>` : ''
  const metaLine = `Worker: <strong>${data.workerName}</strong>${siteStr} &nbsp;·&nbsp; Completed: <strong>${date}</strong>`

  const sigs = buildSigs(data.workerName, data.completedAt, data.requireWitness, inducteeDataUrl, witnessDataUrl)

  if (data.formType === 'interactive') {
    return `${PDF_STYLES}
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <div class="brand">Earthcare Landscapes</div>
      <h1>${data.templateTitle}</h1>
      <div class="meta">${metaLine}</div>
    </div>
    <div class="hdr-right"><img src="${LOGO_DATA_URL}" alt="Earthcare" /></div>
  </div>
  ${buildInteractiveBody(data.sections, data.responses)}
  ${buildNotesBlock(data.notes)}
  <div class="completion-record">
    <h3>Signatures</h3>
    ${sigs}
  </div>
</div>`
  }

  // SWMS / JSA — render the full content_html (which has its own header), then append the completion record
  return `${PDF_STYLES}
<div class="page">
  ${data.contentHtml ?? ''}
  <div class="completion-record">
    <h3>Digital Completion Record</h3>
    <p class="cr-meta">&#10003; I have read, understood and will comply with the requirements of this document.</p>
    <p class="cr-meta">${metaLine}</p>
    ${buildNotesBlock(data.notes)}
    ${sigs}
  </div>
</div>`
}

export async function generateFormCompletionPdf(data: FormPdfData): Promise<void> {
  // Pre-convert signature URLs to data URLs before building HTML.
  // html2canvas can silently fail to render <img> sources in detached elements;
  // giving it an already-decoded data URL removes all CORS and loading dependencies.
  const [inducteeDataUrl, witnessDataUrl] = await Promise.all([
    ensureDataUrl(data.inducteeSignatureUrl),
    ensureDataUrl(data.witnessSignatureUrl),
  ])
  const html = buildHtml(data, inducteeDataUrl, witnessDataUrl)
  const el = document.createElement('div')
  el.innerHTML = html

  const slug     = data.workerName.replace(/\s+/g, '-').toLowerCase()
  const dateStr  = data.completedAt.slice(0, 10)
  const typeStr  = data.formType === 'interactive' ? 'induction' : 'swms'
  const filename = `earthcare-${typeStr}-${slug}-${dateStr}.pdf`

  const { default: html2pdf } = await import('html2pdf.js')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (html2pdf() as any)
    .set({
      margin: 8,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    })
    .from(el)
    .save()
}
