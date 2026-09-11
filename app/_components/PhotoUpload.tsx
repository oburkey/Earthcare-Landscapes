'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compressImage'
import { PHOTO_CATEGORIES, PHOTO_CATEGORY_LABELS } from '@/lib/lotStatus'
import type { UploadAction } from '@/types/actions'

interface Props {
  action: UploadAction
  hiddenFields: Record<string, string>
}

const PHOTO_TYPES = [
  { value: 'before', label: 'Before' },
  { value: 'during', label: 'During' },
  { value: 'after',  label: 'After' },
] as const

export default function PhotoUpload({ action, hiddenFields }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [uploading, startUpload] = useTransition()

  const busy = compressing || uploading

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const files = (formData.getAll('photo') as File[]).filter((f) => f && f.size > 0)

    if (files.length === 0) { setError('No file selected.'); return }

    // Shared fields applied to every photo in the batch
    const photoType     = formData.get('photo_type') as string
    const photoCategory = formData.get('photo_category') as string
    const notes         = formData.get('notes') as string

    setCompressing(true)
    const compressedFiles: File[] = []
    try {
      for (const file of files) {
        compressedFiles.push(await compressImage(file, 1920, 800 * 1024))
      }
    } catch {
      setError('Failed to compress image.')
      setCompressing(false)
      return
    }
    setCompressing(false)

    startUpload(async () => {
      const errors: string[] = []

      for (let i = 0; i < compressedFiles.length; i++) {
        setProgress({ current: i + 1, total: compressedFiles.length })

        const single = new FormData()
        for (const [name, value] of Object.entries(hiddenFields)) single.set(name, value)
        single.set('photo_type', photoType)
        single.set('photo_category', photoCategory)
        single.set('notes', notes)
        single.set('photo', compressedFiles[i], compressedFiles[i].name)

        const result = await action(single)
        if (result?.error) errors.push(`${compressedFiles[i].name}: ${result.error}`)
      }

      setProgress(null)

      if (errors.length > 0) {
        setError(errors.join(' '))
      }
      if (errors.length < compressedFiles.length) {
        formRef.current?.reset()
        router.refresh()
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div>
        <p className="text-sm font-medium text-fg-secondary mb-2">Type</p>
        <div className="flex gap-2">
          {PHOTO_TYPES.map(({ value, label }, i) => (
            <label key={value} className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="photo_type"
                value={value}
                defaultChecked={i === 0}
                className="sr-only peer"
                required
              />
              <span className="block text-center rounded-lg border border-border px-2 py-2 text-sm font-medium text-fg peer-checked:border-green-600 peer-checked:bg-green-50 peer-checked:text-green-700 dark:peer-checked:bg-green-900/30 dark:peer-checked:text-green-400 transition-colors select-none">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-fg-secondary mb-2">Category <span className="font-normal text-fg-muted">(applied to all selected photos)</span></p>
        <select
          name="photo_category"
          defaultValue="general"
          disabled={busy}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:opacity-50"
        >
          {PHOTO_CATEGORIES.map((c) => (
            <option key={c} value={c}>{PHOTO_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-medium text-fg-secondary mb-2">Photo(s)</p>
        <input
          type="file"
          name="photo"
          accept="image/*"
          multiple
          required
          disabled={busy}
          className="block w-full text-sm text-fg-muted
            file:mr-3 file:py-2.5 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-medium
            file:bg-green-700 file:text-white
            hover:file:bg-green-800 file:cursor-pointer
            file:transition-colors disabled:opacity-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-fg-secondary mb-2">Note (optional) <span className="font-normal text-fg-muted">(applied to all selected photos)</span></label>
        <input
          type="text"
          name="notes"
          placeholder="Optional caption"
          disabled={busy}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:opacity-50"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900 disabled:opacity-50 transition-colors"
      >
        {compressing
          ? 'Compressing…'
          : uploading
            ? (progress ? `Uploading ${progress.current}/${progress.total}…` : 'Uploading…')
            : 'Upload photo(s)'}
      </button>
    </form>
  )
}
