'use client'

import { getCompletionPdfData, uploadSignedPdf, reportSignedPdfError, getSignedPdfUrl } from './forms-actions'
import { buildFormCompletionPdfBlob } from './formPdf'

// Makes the signed PDF from the completion's snapshot and stores it in R2.
// Used straight after submit, and by admins' "Regenerate PDF". Any failure is
// recorded on the completion (signed_pdf_error) so it shows up for admins —
// the submission itself is already saved.
export async function storeSignedPdf(assignmentId: string, completionId: string): Promise<{ error?: string }> {
  try {
    const data = await getCompletionPdfData(assignmentId)
    if ('error' in data) throw new Error(data.error)

    const blob = await buildFormCompletionPdfBlob(data)
    const fd = new FormData()
    fd.set('completion_id', completionId)
    fd.set('pdf', new File([blob], 'signed-form.pdf', { type: 'application/pdf' }))

    const result = await uploadSignedPdf(fd)
    if (result.error) throw new Error(result.error)
    return {}
  } catch (e) {
    const message = e instanceof Error ? e.message : 'PDF could not be generated'
    await reportSignedPdfError(completionId, message).catch(() => {})
    return { error: message }
  }
}

// Downloads the stored signed PDF. Never rebuilds it.
export async function downloadSignedPdf(assignmentId: string): Promise<{ error?: string }> {
  const result = await getSignedPdfUrl(assignmentId)
  if (!result.url) return { error: result.error ?? 'No signed PDF stored for this form.' }
  // The link is served as an attachment, so this downloads without leaving the page
  window.location.href = result.url
  return {}
}
