'use client'

import type { SafetyDocRow, SignoffRow } from './SafetyView'

interface Props {
  signoffs:        SignoffRow[]
  docs:            SafetyDocRow[]
  mySignoffIds:    string[]
  isSupervisorPlus: boolean
}

export default function SignoffsTab({ signoffs, docs, mySignoffIds, isSupervisorPlus }: Props) {

  if (isSupervisorPlus) {
    // ── Supervisor: all signoffs grouped by document ───────────────────────────

    // Build a map: documentId → { title, signoffs[] }
    const docMap = new Map<string, { title: string; signoffs: SignoffRow[] }>()
    for (const s of signoffs) {
      if (!docMap.has(s.documentId)) {
        docMap.set(s.documentId, { title: s.documentTitle, signoffs: [] })
      }
      docMap.get(s.documentId)!.signoffs.push(s)
    }

    // Add docs with no signoffs so they're still shown
    for (const doc of docs) {
      if (!docMap.has(doc.id)) {
        docMap.set(doc.id, { title: doc.title, signoffs: [] })
      }
    }

    const entries = Array.from(docMap.entries()).sort((a, b) => a[1].title.localeCompare(b[1].title))

    return (
      <div className="space-y-4">
        <p className="text-sm text-stone-500">
          {signoffs.length} sign-off{signoffs.length !== 1 ? 's' : ''} across {docMap.size} document{docMap.size !== 1 ? 's' : ''}
        </p>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-14 text-center">
            <p className="text-sm font-medium text-stone-600">No sign-offs recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(([docId, { title, signoffs: docSignoffs }]) => (
              <div key={docId} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-stone-50 border-b border-stone-200">
                  <p className="text-sm font-semibold text-stone-800">{title}</p>
                  <span className="text-xs text-stone-400">{docSignoffs.length} signed</span>
                </div>
                {docSignoffs.length === 0 ? (
                  <p className="px-5 py-3 text-sm text-stone-400 italic">No sign-offs yet</p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {docSignoffs.map(s => (
                      <div key={s.id} className="flex items-start justify-between gap-3 px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-stone-800">{s.signerName}</p>
                          {s.signatureNotes && (
                            <p className="text-xs text-stone-500 mt-0.5">{s.signatureNotes}</p>
                          )}
                        </div>
                        <span className="text-xs text-stone-400 shrink-0">
                          {new Date(s.signedAt).toLocaleDateString('en-AU', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Non-supervisor: own signoffs + unsigned docs ────────────────────────────

  const signedDocIds  = new Set(mySignoffIds)
  const unsignedDocs  = docs.filter(d => !signedDocIds.has(d.id))

  return (
    <div className="space-y-5">
      {/* Unsigned documents */}
      {unsignedDocs.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900 mb-2">
            {unsignedDocs.length} document{unsignedDocs.length !== 1 ? 's' : ''} pending your sign-off
          </p>
          <ul className="space-y-1">
            {unsignedDocs.map(d => (
              <li key={d.id} className="text-sm text-amber-800">· {d.title}</li>
            ))}
          </ul>
          <p className="text-xs text-amber-700 mt-2">Visit the Documents tab to sign off on these.</p>
        </div>
      )}

      {/* Own sign-offs */}
      <div>
        <p className="text-sm font-semibold text-stone-700 mb-3">
          Your sign-offs ({signoffs.length})
        </p>
        {signoffs.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-12 text-center">
            <p className="text-sm text-stone-400">You haven&apos;t signed off on any documents yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
            {signoffs.map(s => (
              <div key={s.id} className="flex items-start justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-stone-800">{s.documentTitle}</p>
                  {s.signatureNotes && (
                    <p className="text-xs text-stone-500 mt-0.5">{s.signatureNotes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Signed ✓</span>
                  <p className="text-xs text-stone-400 mt-1">
                    {new Date(s.signedAt).toLocaleDateString('en-AU', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
