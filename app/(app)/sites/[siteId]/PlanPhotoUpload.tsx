'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compressImage'
import type { UploadAction } from '@/types/actions'

interface Props {
  action: UploadAction
  hiddenFields: Record<string, string>
  hasPlan: boolean
}

export default function PlanPhotoUpload({ action, hiddenFields, hasPlan }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [uploading, startUpload] = useTransition()

  const busy = compressing || uploading

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const file = formData.get('photo') as File

    if (!file || file.size === 0) { setError('No file selected.'); return }

    // Compress client-side: max 1920px wide, max 800 KB
    setCompressing(true)
    let compressed: File
    try {
      compressed = await compressImage(file, 1920, 800 * 1024)
    } catch {
      setError('Failed to compress image.')
      setCompressing(false)
      return
    }
    setCompressing(false)

    formData.set('photo', compressed, compressed.name)

    startUpload(async () => {
      const result = await action(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        formRef.current?.reset()
        router.refresh()
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <input
          type="file"
          name="photo"
          accept="image/*"
          required
          disabled={busy}
          className="flex-1 min-w-0 text-sm text-stone-500
            file:mr-3 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-medium
            file:bg-stone-700 file:text-white
            hover:file:bg-stone-800 file:cursor-pointer
            file:transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-lg bg-stone-700 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 active:bg-stone-900 disabled:opacity-50 transition-colors"
        >
          {compressing ? 'Compressing…' : uploading ? 'Uploading…' : hasPlan ? 'Replace plan' : 'Upload plan'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </form>
  )
}
