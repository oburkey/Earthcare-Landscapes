'use client'

import { useRef, useState, useTransition } from 'react'
import { updateExtraJobText } from './actions'
import { useSyncedState } from '@/lib/useSyncedState'

// Title / description edited in place (spans only, so it can sit inside an h1): click to edit, saves on blur or with
// Save; Escape cancels. Read-only (plain text) when canEdit is false.

interface Props {
  extraJobId: string
  siteId: string
  stageId: string
  field: 'title' | 'description'
  value: string
  canEdit: boolean
  placeholder?: string
  className?: string
}

export default function ExtraJobInlineField({
  extraJobId, siteId, stageId, field, value: serverValue, canEdit, placeholder, className = '',
}: Props) {
  const multiline = field === 'description'
  const [value, setValue]     = useSyncedState(serverValue)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // Escape / Cancel unmount the input, which fires blur — don't save then
  const skipBlurSave = useRef(false)

  if (!canEdit) {
    if (!value) return null
    return <span className={`${className} block ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value}</span>
  }

  function startEdit() {
    setDraft(value)
    setError(null)
    skipBlurSave.current = false
    setEditing(true)
  }

  function cancel() {
    skipBlurSave.current = true
    setError(null)
    setEditing(false)
  }

  function save() {
    if (skipBlurSave.current || isPending) return
    const next = draft.trim()
    if (next === value.trim()) { setEditing(false); setError(null); return }
    if (field === 'title' && !next) { setError('Title is required.'); return }
    startTransition(async () => {
      const result = await updateExtraJobText(extraJobId, siteId, stageId, field, next)
      if (result?.error) {
        setError(result.error)
        return
      }
      setValue(next)
      setError(null)
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        title={`Click to edit ${field}`}
        className={`${className} block w-full text-left rounded-md -mx-1.5 px-1.5 -my-0.5 py-0.5 hover:bg-surface-raised ${multiline ? 'whitespace-pre-wrap' : ''}`}
      >
        {value || <span className="text-fg-muted italic font-normal">{placeholder}</span>}
      </button>
    )
  }

  const inputClass = 'block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600'

  return (
    <span className="block space-y-2">
      {multiline ? (
        <textarea
          autoFocus
          rows={3}
          value={draft}
          disabled={isPending}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
          className={`${inputClass} resize-y`}
        />
      ) : (
        <input
          autoFocus
          type="text"
          value={draft}
          disabled={isPending}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save() }
            if (e.key === 'Escape') cancel()
          }}
          className={`${inputClass} text-base font-semibold`}
        />
      )}
      <span className="flex items-center gap-3">
        {/* onMouseDown preventDefault keeps focus in the input, so blur doesn't save first */}
        <button
          type="button"
          disabled={isPending}
          onMouseDown={(e) => e.preventDefault()}
          onClick={save}
          className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancel}
          className="text-xs text-fg-muted hover:text-fg-secondary"
        >
          Cancel
        </button>
        {error && <span className="text-xs font-normal text-red-600 dark:text-red-400">{error}</span>}
      </span>
    </span>
  )
}
