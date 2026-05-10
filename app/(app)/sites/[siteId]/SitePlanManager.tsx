'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compressImage'
import { deleteSitePlanDoc, uploadSitePlanDoc } from './actions'
import type { UploadActionState } from '@/types/actions'

interface Plan {
  id: string
  url: string
  label: string | null
}

interface Props {
  siteId: string
  isAdmin: boolean
  plans: Plan[]
  legacyPlanUrl: string | null
}

export default function SitePlanManager({ siteId, isAdmin, plans, legacyPlanUrl }: Props) {
  const allPlans = plans.length > 0
    ? plans
    : legacyPlanUrl
      ? [{ id: '__legacy__', url: legacyPlanUrl, label: null }]
      : []

  return (
    <div className="space-y-3">
      {allPlans.length === 0 ? (
        isAdmin ? null : (
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-400 text-center py-4">No site plan uploaded yet.</p>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {allPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} siteId={siteId} isAdmin={isAdmin} isLegacy={plan.id === '__legacy__'} />
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-medium text-stone-700 mb-3">
            {allPlans.length > 0 ? 'Add another plan' : 'Upload site plan'}
          </p>
          <UploadForm siteId={siteId} />
        </div>
      )}
    </div>
  )
}

// ── Plan card ──────────────────────────────────────────────────────────────────

function PlanCard({ plan, siteId, isAdmin, isLegacy }: { plan: Plan; siteId: string; isAdmin: boolean; isLegacy: boolean }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteState, deleteAction, deletePending] = useActionState<UploadActionState, FormData>(
    deleteSitePlanDoc,
    null
  )

  const showFooter = plan.label || (isAdmin && !isLegacy)

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <a href={plan.url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={plan.url}
          alt={plan.label ?? 'Site plan'}
          className="w-full object-contain max-h-[60vh] hover:opacity-95 transition-opacity"
        />
      </a>

      {showFooter && (
        <div className="px-4 py-3 border-t border-stone-100 flex items-center justify-between gap-3">
          <span className="text-sm text-stone-600">{plan.label ?? ''}</span>

          {isAdmin && !isLegacy && (
            <div className="shrink-0">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <form action={deleteAction}>
                    <input type="hidden" name="site_id" value={siteId} />
                    <input type="hidden" name="doc_id"  value={plan.id} />
                    <button
                      type="submit"
                      disabled={deletePending}
                      className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletePending ? 'Removing…' : 'Yes, remove'}
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-stone-500 hover:text-stone-700"
                  >
                    Cancel
                  </button>
                  {deleteState?.error && (
                    <span className="text-xs text-red-600">{deleteState.error}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Upload form ────────────────────────────────────────────────────────────────

function UploadForm({ siteId }: { siteId: string }) {
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
      const result = await uploadSitePlanDoc(null, formData)
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
      <input type="hidden" name="site_id" value={siteId} />

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Label (optional)</label>
        <input
          name="label"
          type="text"
          placeholder="e.g. Stage 1 overview"
          disabled={busy}
          className="block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:opacity-50"
        />
      </div>

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
          {compressing ? 'Compressing…' : uploading ? 'Uploading…' : 'Upload plan'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </form>
  )
}
