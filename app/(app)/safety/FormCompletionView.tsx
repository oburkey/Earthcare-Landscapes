'use client'

import { useRef, useState } from 'react'
import SignaturePad, { type SignaturePadHandle } from './SignaturePad'
import { submitFormCompletion } from './forms-actions'
import type { FormSection, SafetyFormType } from '@/types/database'

export interface CompletionAssignment {
  id: string
  templateTitle: string
  formType: SafetyFormType
  sections: FormSection[]
  contentHtml: string | null
  requireWitness: boolean
  siteName: string | null
}

interface Props {
  assignment: CompletionAssignment
  onClose: () => void
  onCompleted: (assignmentId: string) => void
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], name, { type: 'image/png' })
}

export default function FormCompletionView({ assignment, onClose, onCompleted }: Props) {
  const inducteeRef = useRef<SignaturePadHandle>(null)
  const witnessRef  = useRef<SignaturePadHandle>(null)

  const [responses, setResponses]   = useState<Record<string, boolean | 'yes' | 'no' | string>>({})
  const [notes, setNotes]           = useState('')
  const [confirmed, setConfirmed]   = useState(false)  // for SWMS/JSA ack checkbox
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  function setResponse(itemId: string, value: boolean | 'yes' | 'no' | string) {
    setResponses(prev => ({ ...prev, [itemId]: value }))
  }

  async function handleSubmit() {
    setError(null)

    // Validate required items (interactive forms)
    if (assignment.formType === 'interactive') {
      for (const section of assignment.sections) {
        for (const item of section.items) {
          if (item.required && (responses[item.id] === undefined || responses[item.id] === '')) {
            setError(`Required: "${item.label}"`)
            return
          }
        }
      }
    }

    // Validate SWMS/JSA confirmation
    if ((assignment.formType === 'swms' || assignment.formType === 'jsa') && !confirmed) {
      setError('You must confirm you have read and understood the document.')
      return
    }

    // Validate inductee signature
    if (inducteeRef.current?.isEmpty()) {
      setError('Your signature is required.')
      return
    }

    // Validate witness signature
    if (assignment.requireWitness && witnessRef.current?.isEmpty()) {
      setError('Witness signature is required.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('assignment_id', assignment.id)
      fd.set('responses', JSON.stringify(responses))
      fd.set('notes', notes)

      const inducteeDataUrl = inducteeRef.current?.toDataURL()
      if (inducteeDataUrl) {
        fd.append('inductee_signature', await dataUrlToFile(inducteeDataUrl, 'inductee.png'))
      }

      const witnessDataUrl = witnessRef.current?.toDataURL()
      if (witnessDataUrl) {
        fd.append('witness_signature', await dataUrlToFile(witnessDataUrl, 'witness.png'))
      }

      const result = await submitFormCompletion(fd)
      if (result?.error) {
        setError(result.error)
        return
      }

      onCompleted(assignment.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const formTypeBadge: Record<SafetyFormType, string> = {
    interactive: 'Induction / Checklist',
    swms:        'SWMS Sign-on',
    jsa:         'JSA Sign-on',
    reference:   'Reference Document',
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3 gap-3">
        <div className="min-w-0">
          <p className="text-xs text-fg-muted">{formTypeBadge[assignment.formType]}</p>
          <h2 className="text-base font-semibold text-fg truncate">{assignment.templateTitle}</h2>
          {assignment.siteName && (
            <p className="text-xs text-fg-muted">{assignment.siteName}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-8">

        {/* ── Interactive form sections ────────────────────────────────────── */}
        {assignment.formType === 'interactive' && assignment.sections.map((section, si) => (
          <div key={si} className="space-y-3">
            <h3 className="text-sm font-semibold text-fg border-b border-border pb-1.5">{section.title}</h3>
            <div className="space-y-2">
              {section.items.map(item => (
                <div key={item.id} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-sm text-fg mb-2">
                    {item.label}
                    {item.required && <span className="text-red-500 ml-1">*</span>}
                  </p>

                  {item.type === 'checkbox' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={responses[item.id] === true}
                        onChange={e => setResponse(item.id, e.target.checked)}
                        className="h-4 w-4 rounded border-border text-green-700 focus:ring-green-600 focus:ring-1 focus:outline-none"
                      />
                      <span className="text-sm text-fg-secondary">Confirmed</span>
                    </label>
                  )}

                  {item.type === 'yes_no' && (
                    <div className="flex gap-2">
                      {(['yes', 'no'] as const).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setResponse(item.id, val)}
                          className={`rounded-lg px-4 py-1.5 text-sm font-medium border transition-colors ${
                            responses[item.id] === val
                              ? val === 'yes'
                                ? 'bg-green-700 text-white border-green-700'
                                : 'bg-red-600 text-white border-red-600'
                              : 'border-border text-fg-secondary hover:bg-surface-raised'
                          }`}
                        >
                          {val === 'yes' ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                  )}

                  {item.type === 'text' && (
                    <textarea
                      rows={2}
                      value={(responses[item.id] as string) ?? ''}
                      onChange={e => setResponse(item.id, e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
                      placeholder="Enter response…"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── SWMS / JSA document content ──────────────────────────────────── */}
        {(assignment.formType === 'swms' || assignment.formType === 'jsa') && assignment.contentHtml && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <div
              className="prose prose-sm max-w-none text-fg"
              dangerouslySetInnerHTML={{ __html: assignment.contentHtml }}
            />
          </div>
        )}

        {/* SWMS/JSA acknowledgement */}
        {(assignment.formType === 'swms' || assignment.formType === 'jsa') && (
          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border bg-surface p-4">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-green-700 focus:ring-green-600 focus:ring-1 focus:outline-none"
            />
            <span className="text-sm text-fg">
              I have read, understood and will comply with this document.
            </span>
          </label>
        )}

        {/* ── Notes ────────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-fg mb-1.5">Notes (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional notes…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
          />
        </div>

        {/* ── Signatures ───────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-fg">Signatures</h3>
          <SignaturePad ref={inducteeRef} label="Your signature *" />
          {assignment.requireWitness && (
            <SignaturePad ref={witnessRef} label="Witness / Safety rep signature *" />
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit & Sign'}
        </button>
      </div>
    </div>
  )
}
