'use client'

import { useState, useTransition } from 'react'
import { toggleLotFlag } from './actions'

type Flag = 'build_complete' | 'quant_done' | 'invoiced'

interface Props {
  lotId: string
  siteId: string
  stageId: string
  buildComplete: boolean
  quantDone: boolean
  invoiced: boolean
  canSupervise: boolean
  isAdmin: boolean
}

export default function LotStatusToggles({
  lotId, siteId, stageId,
  buildComplete: initBuild,
  quantDone: initQuant,
  invoiced: initInvoiced,
  canSupervise,
  isAdmin,
}: Props) {
  const [buildComplete, setBuildComplete] = useState(initBuild)
  const [quantDone,     setQuantDone]     = useState(initQuant)
  const [invoiced,      setInvoiced]      = useState(initInvoiced)
  const [error, setError]                 = useState<string | null>(null)
  const [isPending, startTransition]      = useTransition()

  function toggle(flag: Flag, current: boolean, set: (v: boolean) => void) {
    const next = !current
    set(next)        // optimistic
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
        set(current)        // revert on failure
        setError(result.error)
      }
    })
  }

  const pill = (on: boolean) =>
    on
      ? 'bg-green-100 text-green-700'
      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'

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
          <button
            type="button"
            disabled={isPending}
            onClick={() => toggle('invoiced', invoiced, setInvoiced)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${pill(invoiced)}`}
          >
            Invoiced
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
