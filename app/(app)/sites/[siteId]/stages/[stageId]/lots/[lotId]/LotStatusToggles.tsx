'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleLotFlag } from './actions'

type Flag = 'build_complete' | 'quant_done' | 'invoiced' | 'has_client_extras'

interface Props {
  lotId: string
  siteId: string
  stageId: string
  buildComplete: boolean
  quantDone: boolean
  invoiced: boolean
  hasClientExtras: boolean
  siteHasClientExtras: boolean
  canSupervise: boolean
  isAdmin: boolean
}

export default function LotStatusToggles({
  lotId, siteId, stageId,
  buildComplete: initBuild,
  quantDone: initQuant,
  invoiced: initInvoiced,
  hasClientExtras: initClientExtras,
  siteHasClientExtras,
  canSupervise,
  isAdmin,
}: Props) {
  const router = useRouter()
  const [buildComplete,   setBuildComplete]   = useState(initBuild)
  const [quantDone,       setQuantDone]       = useState(initQuant)
  const [invoiced,        setInvoiced]        = useState(initInvoiced)
  const [hasClientExtras, setHasClientExtras] = useState(initClientExtras)
  const [error, setError]                     = useState<string | null>(null)
  const [isPending, startTransition]          = useTransition()

  function toggle(flag: Flag, current: boolean, set: (v: boolean) => void, refresh = false) {
    const next = !current
    set(next)
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('lot_id',   lotId)
      fd.set('site_id',  siteId)
      fd.set('stage_id', stageId)
      fd.set('flag',     flag)
      fd.set('value',    String(next))
      const result = await toggleLotFlag(null, fd)
      if (result?.error) {
        set(current)
        setError(result.error)
      } else if (refresh) {
        router.refresh()
      }
    })
  }

  const pill = (on: boolean) =>
    on
      ? 'bg-accent-dim text-accent-fg'
      : 'bg-surface-raised text-fg-muted hover:bg-surface-raised'

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {canSupervise && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => toggle('build_complete', buildComplete, setBuildComplete)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${pill(buildComplete)}`}
            >
              Build Complete
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => toggle('quant_done', quantDone, setQuantDone)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${pill(quantDone)}`}
            >
              Quant Done
            </button>
          </>
        )}
        {isAdmin && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => toggle('invoiced', invoiced, setInvoiced)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${pill(invoiced)}`}
            >
              Invoiced
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => toggle('has_client_extras', hasClientExtras, setHasClientExtras, true)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${pill(hasClientExtras && siteHasClientExtras)}`}
              title={!siteHasClientExtras ? 'Disabled at site level' : undefined}
            >
              Client Extras
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
