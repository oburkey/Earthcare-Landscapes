'use client'

import { useActionState, useState } from 'react'
import { updateTradeStatus } from './actions'
import { TRADE_OPTIONS } from '@/lib/lotStatus'
import type { ActionState } from '@/types/actions'

interface Props {
  lotId: string
  siteId: string
  stageId: string
  canManage: boolean
  tradesCompleted: string[]
  readyForLandscaping: boolean
  blockingNotes: string | null
  updatedByName: string | null
  updatedAt: string | null
}

function formatDateTime(value: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function TradeStatusSection({
  lotId, siteId, stageId, canManage,
  tradesCompleted, readyForLandscaping, blockingNotes,
  updatedByName, updatedAt,
}: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateTradeStatus, null)
  const [ready, setReady] = useState(readyForLandscaping)
  const [trades, setTrades] = useState<string[]>(tradesCompleted)
  const [notes, setNotes] = useState(blockingNotes ?? '')

  function toggleTrade(trade: string) {
    setTrades((prev) => prev.includes(trade) ? prev.filter((t) => t !== trade) : [...prev, trade])
  }

  const lastUpdated = updatedByName && updatedAt
    ? `Last updated by ${updatedByName} on ${formatDateTime(updatedAt)}`
    : null

  if (!canManage) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <div>
          <p className="text-xs font-medium text-stone-500 mb-1.5">Trades completed</p>
          {tradesCompleted.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tradesCompleted.map((trade) => (
                <span key={trade} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                  {trade}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400">None recorded</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-stone-500 mb-1">Ready for landscaping?</p>
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
            readyForLandscaping ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {readyForLandscaping ? 'Yes' : 'No'}
          </span>
        </div>
        {!readyForLandscaping && blockingNotes && (
          <div>
            <p className="text-xs font-medium text-stone-500 mb-1">What&apos;s blocking us?</p>
            <p className="text-sm text-stone-800 whitespace-pre-wrap">{blockingNotes}</p>
          </div>
        )}
        {lastUpdated && <p className="text-xs text-stone-400">{lastUpdated}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="lot_id" value={lotId} />
        <input type="hidden" name="site_id" value={siteId} />
        <input type="hidden" name="stage_id" value={stageId} />
        <input type="hidden" name="ready_for_landscaping" value={String(ready)} />

        {/* Trades completed */}
        <div>
          <p className="block text-sm font-medium text-stone-700 mb-2">Trades completed</p>
          <div className="flex flex-wrap gap-2">
            {TRADE_OPTIONS.map((trade) => (
              <label key={trade} className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-stone-200 px-3 py-1.5">
                <input
                  type="checkbox"
                  name="trades_completed"
                  value={trade}
                  checked={trades.includes(trade)}
                  onChange={() => toggleTrade(trade)}
                  className="h-4 w-4 rounded border-stone-300 text-green-700 focus:ring-green-600"
                />
                <span className="text-sm text-stone-700">{trade}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Ready for landscaping toggle */}
        <div>
          <p className="block text-sm font-medium text-stone-700 mb-2">Ready for landscaping?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReady(true)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                ready ? 'bg-green-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setReady(false)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                !ready ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              No
            </button>
          </div>
        </div>

        {/* Blocking notes — required when not ready */}
        {!ready && (
          <div>
            <label htmlFor="blocking_notes" className="block text-sm font-medium text-stone-700">
              What&apos;s blocking us?
            </label>
            <textarea
              id="blocking_notes"
              name="blocking_notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Waiting on fencer to finish boundary"
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
            />
          </div>
        )}

        {lastUpdated && <p className="text-xs text-stone-400">{lastUpdated}</p>}

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
