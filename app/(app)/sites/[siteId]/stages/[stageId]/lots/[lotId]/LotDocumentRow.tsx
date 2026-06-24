'use client'

import { useActionState, useState } from 'react'
import { deleteLotDocument } from './actions'
import type { ActionState } from '@/types/actions'

interface Props {
  docId: string
  documentName: string
  documentTypeLabel: string
  url: string
  lotId: string
  siteId: string
  stageId: string
  isAdmin: boolean
}

export default function LotDocumentRow({
  docId, documentName, documentTypeLabel, url,
  lotId, siteId, stageId, isAdmin,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteLotDocument, null)

  return (
    <div className="px-4 py-3.5 space-y-2">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-900 truncate">{documentName}</p>
          <p className="text-xs text-stone-500">{documentTypeLabel}</p>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
          View PDF
        </a>
        {isAdmin && !confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="shrink-0 text-stone-300 hover:text-red-500 transition-colors"
            title="Delete document"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        )}
      </div>
      {confirmDelete && (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-stone-600">Delete &ldquo;{documentName}&rdquo;?</p>
          <form action={action}>
            <input type="hidden" name="document_id" value={docId} />
            <input type="hidden" name="lot_id" value={lotId} />
            <input type="hidden" name="site_id" value={siteId} />
            <input type="hidden" name="stage_id" value={stageId} />
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? 'Deleting…' : 'Yes, delete'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-stone-500 hover:text-stone-700"
          >
            Cancel
          </button>
          {state?.error && (
            <p className="text-xs text-red-600 w-full">{state.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
