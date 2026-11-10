'use client'

import type { ReactNode } from 'react'
import { formStatus, formatYmd, type AssignmentManagementRow } from './FormsList'
import { addDays } from '@/lib/emails/dateUtils'

// Safety Admin → Needs attention: incomplete forms by person that are
// overdue, due within 7 days, or have no due date. Hidden when there are none.

type Item = { row: AssignmentManagementRow; kind: 'overdue' | 'soon' | 'undated' }

const KIND_ORDER: Record<Item['kind'], number> = { overdue: 0, soon: 1, undated: 2 }

interface Props {
  rows: AssignmentManagementRow[]
  todayPerth: string
}

export default function NeedsAttention({ rows, todayPerth }: Props) {
  const weekAhead = addDays(todayPerth, 7)

  const byPerson = new Map<string, { name: string; items: Item[] }>()
  for (const row of rows) {
    const status = formStatus(row, todayPerth)
    if (status === 'completed') continue
    const kind: Item['kind'] | null =
      status === 'overdue' ? 'overdue'
      : !row.dueDate ? 'undated'
      : row.dueDate <= weekAhead ? 'soon'
      : null
    if (!kind) continue
    const entry = byPerson.get(row.assignedTo) ?? { name: row.assigneeName, items: [] }
    entry.items.push({ row, kind })
    byPerson.set(row.assignedTo, entry)
  }

  const people = [...byPerson.values()]
    .map(p => ({ ...p, items: p.items.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) }))
    .sort((a, b) =>
      b.items.filter(i => i.kind === 'overdue').length - a.items.filter(i => i.kind === 'overdue').length
      || a.name.localeCompare(b.name))

  if (people.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-fg-secondary">Needs attention</h2>
      <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
        {people.map(p => {
          const overdue = p.items.filter(i => i.kind === 'overdue').length
          const soon    = p.items.filter(i => i.kind === 'soon').length
          const undated = p.items.filter(i => i.kind === 'undated').length
          return (
            <div key={p.name + p.items[0].row.assignedTo} className="px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-fg">
                {p.name}
                <span className="ml-2 text-xs font-normal">
                  {[
                    overdue > 0 && <span key="o" className="text-red-600">{overdue} overdue</span>,
                    soon > 0 && <span key="s" className="text-amber-700 dark:text-amber-400">{soon} due this week</span>,
                    undated > 0 && <span key="u" className="text-fg-muted">{undated} no due date</span>,
                  ].filter(Boolean).reduce<ReactNode[]>((acc, el, i) => (i === 0 ? [el] : [...acc, ' · ', el]), [])}
                </span>
              </p>
              <ul className="text-xs text-fg-muted space-y-0.5">
                {p.items.map(({ row, kind }) => (
                  <li key={row.id} className={kind === 'overdue' ? 'text-red-600' : undefined}>
                    {row.templateTitle}
                    {row.siteName && ` · ${row.siteName}`}
                    {row.dueDate ? ` · ${kind === 'overdue' ? 'was due' : 'due'} ${formatYmd(row.dueDate)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
