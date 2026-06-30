'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compressImage'
import { deleteSitePlanDoc, renameSitePlanDoc, uploadSitePlanDoc } from './actions'
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
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-fg-muted text-center py-4">No site plan uploaded yet.</p>
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
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-medium text-fg-secondary mb-3">
            {allPlans.length > 0 ? 'Add another plan' : 'Upload site plan'}
          </p>
          <UploadForm siteId={siteId} />
        </div>
      )}
    </div>
  )
}

// ── Plan card ──────────────────────────────────────────────────────────────────

type CardMode = 'view' | 'editing' | 'deleting'

function PlanCard({ plan, siteId, isAdmin, isLegacy }: { plan: Plan; siteId: string; isAdmin: boolean; isLegacy: boolean }) {
  const router = useRouter()
  const [mode, setMode]               = useState<CardMode>('view')
  const [labelInput, setLabelInput]   = useState(plan.label ?? '')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  const [deleteState, deleteAction, deletePending] = useActionState<UploadActionState, FormData>(
    deleteSitePlanDoc,
    null
  )

  function handleRename() {
    setRenameError(null)
    const fd = new FormData()
    fd.set('site_id', siteId)
    fd.set('doc_id',  plan.id)
    fd.set('label',   labelInput)
    startTransition(async () => {
      const result = await renameSitePlanDoc(null, fd)
      if (result?.error) {
        setRenameError(result.error)
      } else {
        setMode('view')
        router.refresh()
      }
    })
  }

  const showAdminControls = isAdmin && !isLegacy

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <a href={plan.url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={plan.url}
          alt={plan.label ?? 'Site plan'}
          className="w-full object-contain max-h-[60vh] hover:opacity-95 transition-opacity"
        />
      </a>

      {/* Footer — always shown for admin non-legacy plans; shown for labelled plans otherwise */}
      {(plan.label || showAdminControls) && (
        <div className="px-4 py-3 border-t border-border-subtle">

          {/* ── Editing mode ── */}
          {mode === 'editing' && showAdminControls ? (
            <div className="space-y-2">
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Label (optional)"
                autoFocus
                className="block w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-surface text-fg"
              />
              {renameError && <p className="text-xs text-red-600">{renameError}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRename}
                  disabled={isPending}
                  className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('view'); setLabelInput(plan.label ?? ''); setRenameError(null) }}
                  disabled={isPending}
                  className="text-xs text-fg-muted hover:text-fg-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>

          ) : mode === 'deleting' && showAdminControls ? (
            /* ── Delete confirmation mode ── */
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-fg-secondary">Delete this plan?</span>
              <form action={deleteAction} className="flex items-center gap-2">
                <input type="hidden" name="site_id" value={siteId} />
                <input type="hidden" name="doc_id"  value={plan.id} />
                <button
                  type="submit"
                  disabled={deletePending}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletePending ? 'Deleting…' : 'Yes, delete'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setMode('view')}
                disabled={deletePending}
                className="text-xs text-fg-muted hover:text-fg-secondary"
              >
                Cancel
              </button>
              {deleteState?.error && <span className="text-xs text-red-600">{deleteState.error}</span>}
            </div>

          ) : (
            /* ── View mode ── */
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg-secondary truncate">{plan.label ?? ''}</span>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={plan.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-border px-2.5 py-1 text-xs font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
                >
                  View
                </a>
                {showAdminControls && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode('editing')}
                      title="Edit label"
                      className="rounded p-1.5 text-fg-muted hover:text-fg-secondary hover:bg-surface-raised transition-colors"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('deleting')}
                      title="Delete plan"
                      className="rounded p-1.5 text-fg-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
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
        <label className="block text-sm font-medium text-fg-secondary mb-1">Label (optional)</label>
        <input
          name="label"
          type="text"
          placeholder="e.g. Stage 1 overview"
          disabled={busy}
          className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg shadow-sm placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:opacity-50 bg-surface text-fg"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <input
          type="file"
          name="photo"
          accept="image/*"
          required
          disabled={busy}
          className="flex-1 min-w-0 text-sm text-fg-muted
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
