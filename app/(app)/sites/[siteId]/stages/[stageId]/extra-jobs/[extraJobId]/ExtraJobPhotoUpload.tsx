'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { uploadExtraJobPhoto } from './actions'
import { compressImage } from '@/lib/compressImage'

interface Props {
  extraJobId: string
  siteId: string
  stageId: string
}

const PHOTO_TYPES = [
  { value: 'before', label: 'Before' },
  { value: 'during', label: 'During' },
  { value: 'after',  label: 'After' },
] as const

export default function ExtraJobPhotoUpload({ extraJobId, siteId, stageId }: Props) {
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
      const result = await uploadExtraJobPhoto(null, formData)
      if (result?.error) {
        setError(result.error)
      } else {
        formRef.current?.reset()
        router.refresh()
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="extra_job_id" value={extraJobId} />
      <input type="hidden" name="site_id"      value={siteId} />
      <input type="hidden" name="stage_id"     value={stageId} />

      <div>
        <p className="text-sm font-medium text-stone-700 mb-2">Type</p>
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
              <span className="block text-center rounded-lg border border-stone-300 px-2 py-2 text-sm font-medium text-stone-700 peer-checked:border-green-600 peer-checked:bg-green-50 peer-checked:text-green-700 transition-colors select-none">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-stone-700 mb-2">Photo</p>
        <input
          type="file"
          name="photo"
          accept="image/*"
          required
          disabled={busy}
          className="block w-full text-sm text-stone-500
            file:mr-3 file:py-2.5 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-medium
            file:bg-green-700 file:text-white
            hover:file:bg-green-800 file:cursor-pointer
            file:transition-colors disabled:opacity-50"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900 disabled:opacity-50 transition-colors"
      >
        {compressing ? 'Compressing…' : uploading ? 'Uploading…' : 'Upload photo'}
      </button>
    </form>
  )
}
