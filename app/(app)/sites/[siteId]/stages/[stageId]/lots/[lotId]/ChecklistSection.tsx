'use client'

import { useActionState, useState } from 'react'
import { updateChecklist } from './actions'
import { CHECKLIST_SECTIONS, TOTAL_CHECKLIST_ITEMS, type ChecklistSectionId } from '@/lib/checklist'
import type { ActionState } from '@/types/actions'

type ItemState = { completed: boolean; response: 'yes' | 'no' | null; date: string }

interface SavedItem {
  item_key: string
  completed: boolean
  response: 'yes' | 'no' | null
  completed_date: string | null
}

interface Props {
  lotId: string
  siteId: string
  stageId: string
  canManage: boolean
  savedItems: SavedItem[]
  extrasNotes: string | null
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function buildInitialState(savedItems: SavedItem[]): Record<string, ItemState> {
  const saved = new Map(savedItems.map((i) => [i.item_key, i]))
  const state: Record<string, ItemState> = {}
  for (const section of CHECKLIST_SECTIONS) {
    for (const item of section.items) {
      const row = saved.get(item.key)
      state[item.key] = {
        completed: row?.completed ?? false,
        response: row?.response ?? null,
        date: row?.completed_date ?? '',
      }
    }
  }
  return state
}

export default function ChecklistSection({
  lotId, siteId, stageId, canManage, savedItems, extrasNotes,
}: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateChecklist, null)
  const [items, setItems] = useState<Record<string, ItemState>>(() => buildInitialState(savedItems))
  const [open, setOpen] = useState<Record<ChecklistSectionId, boolean>>({
    pre_checks: false,
    landscaping_works: false,
    finishing: false,
  })

  const completedCount = Object.values(items).filter((i) => i.completed).length

  function toggleSection(id: ChecklistSectionId) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function handleCheckboxChange(key: string, checked: boolean) {
    setItems((prev) => {
      const cur = prev[key]
      return { ...prev, [key]: { ...cur, completed: checked, date: checked && !cur.date ? todayStr() : cur.date } }
    })
  }

  function handleResponseChange(key: string, response: 'yes' | 'no') {
    setItems((prev) => {
      const cur = prev[key]
      return { ...prev, [key]: { ...cur, response, completed: true, date: !cur.date ? todayStr() : cur.date } }
    })
  }

  function handleDateChange(key: string, date: string) {
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], date } }))
  }

  return (
    <div className="space-y-3">
      {/* Progress indicator */}
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-stone-700">Progress</span>
          <span className="text-sm font-semibold text-stone-900">
            {completedCount} of {TOTAL_CHECKLIST_ITEMS} items complete
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-stone-100">
          <div
            className="h-2 rounded-full bg-green-600 transition-all"
            style={{ width: `${Math.round((completedCount / TOTAL_CHECKLIST_ITEMS) * 100)}%` }}
          />
        </div>
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="lot_id" value={lotId} />
        <input type="hidden" name="site_id" value={siteId} />
        <input type="hidden" name="stage_id" value={stageId} />

        {CHECKLIST_SECTIONS.map((section) => {
          const sectionCompleted = section.items.filter((i) => items[i.key].completed).length
          const isOpen = open[section.id]
          return (
            <div key={section.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors"
              >
                <span className="text-sm font-semibold text-stone-800">{section.title}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-stone-400">{sectionCompleted}/{section.items.length}</span>
                  <svg
                    className={`h-4 w-4 text-stone-400 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </button>

              {isOpen && (
                <div className="divide-y divide-stone-100 border-t border-stone-100">
                  {section.items.map((item) => {
                    const itemState = items[item.key]

                    if (item.type === 'yesno') {
                      return (
                        <div key={item.key} className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="text-sm text-stone-800 flex-1 min-w-0">{item.label}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <input type="hidden" name={`response__${item.key}`} value={itemState.response ?? ''} />
                            <button
                              type="button"
                              disabled={!canManage}
                              onClick={() => handleResponseChange(item.key, 'yes')}
                              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                                itemState.response === 'yes' ? 'bg-green-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              disabled={!canManage}
                              onClick={() => handleResponseChange(item.key, 'no')}
                              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                                itemState.response === 'no' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                            >
                              No
                            </button>
                            {itemState.completed && (
                              <input
                                type="date"
                                name={`date__${item.key}`}
                                value={itemState.date}
                                onChange={(e) => handleDateChange(item.key, e.target.value)}
                                disabled={!canManage}
                                className="rounded-lg border border-stone-300 px-2 py-1 text-xs focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:bg-stone-50"
                              />
                            )}
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div key={item.key} className="flex items-center justify-between gap-3 px-4 py-3">
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            name={`completed__${item.key}`}
                            value="true"
                            checked={itemState.completed}
                            onChange={(e) => handleCheckboxChange(item.key, e.target.checked)}
                            disabled={!canManage}
                            className="h-4 w-4 shrink-0 rounded border-stone-300 text-green-700 focus:ring-green-600"
                          />
                          <span className="text-sm text-stone-800">{item.label}</span>
                        </label>
                        {itemState.completed && (
                          <input
                            type="date"
                            name={`date__${item.key}`}
                            value={itemState.date}
                            onChange={(e) => handleDateChange(item.key, e.target.value)}
                            disabled={!canManage}
                            className="shrink-0 rounded-lg border border-stone-300 px-2 py-1 text-xs focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:bg-stone-50"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Extras / Comments */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <label htmlFor="extras_notes" className="block text-sm font-medium text-stone-700 mb-1">
            Extras / Comments
          </label>
          <textarea
            id="extras_notes"
            name="extras_notes"
            rows={3}
            defaultValue={extrasNotes ?? ''}
            disabled={!canManage}
            placeholder="Any other notes about this lot…"
            className="block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none disabled:bg-stone-50 disabled:text-stone-400"
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        {canManage && (
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save checklist'}
          </button>
        )}
      </form>
    </div>
  )
}
