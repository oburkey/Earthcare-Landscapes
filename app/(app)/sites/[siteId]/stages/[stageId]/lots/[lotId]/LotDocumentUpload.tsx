'use client'

import { useActionState, useRef } from 'react'
import { uploadLotDocument } from './actions'
import type { ActionState } from '@/types/actions'
import { DOC_TYPE_LABELS } from '@/lib/lotStatus'

interface Props {
  lotId: string
  siteId: string
  stageId: string
}

export default function LotDocumentUpload({ lotId, siteId, stageId }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadLotDocument, null)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await action(fd)
        formRef.current?.reset()
      }}
      className="space-y-3"
    >
      <input type="hidden" name="lot_id"   value={lotId} />
      <input type="hidden" name="site_id"  value={siteId} />
      <input type="hidden" name="stage_id" value={stageId} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="doc-name" className="block text-sm font-medium text-stone-700">
            Document name <span className="text-red-500">*</span>
          </label>
          <input
            id="doc-name"
            name="document_name"
            type="text"
            required
            placeholder="e.g. Approved Drawing Rev 3"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
        <div>
          <label htmlFor="doc-type" className="block text-sm font-medium text-stone-700">
            Type
          </label>
          <select
            id="doc-type"
            name="document_type"
            defaultValue="other"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-white"
          >
            {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="doc-file" className="block text-sm font-medium text-stone-700">
          PDF file <span className="text-red-500">*</span>
        </label>
        <input
          id="doc-file"
          name="file"
          type="file"
          accept="application/pdf"
          required
          className="mt-1 block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
      >
        {pending ? 'Uploading…' : 'Upload document'}
      </button>
    </form>
  )
}
