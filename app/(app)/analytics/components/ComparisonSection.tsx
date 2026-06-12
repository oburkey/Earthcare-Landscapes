'use client'

import { useState } from 'react'
import { fmtCurrency, fmtNumber, fmtPct } from '../format'
import { CATEGORY_LABELS, type AggregateSummary, type SiteAnalytics } from '../lib'

type CompareOption = { key: string; label: string; summary: AggregateSummary }

function buildOptions(sites: SiteAnalytics[]): CompareOption[] {
  const options: CompareOption[] = []
  for (const site of sites) {
    options.push({ key: `site:${site.id}`, label: site.name, summary: site.summary })
    for (const stage of site.stages) {
      options.push({ key: `stage:${stage.id}`, label: `${site.name} / ${stage.name}`, summary: stage.summary })
    }
  }
  return options
}

function CompareCard({ option }: { option: CompareOption }) {
  const { summary } = option
  const categoryKeys = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]
  const varianceEntries = categoryKeys
    .map((key) => ({ key, stat: summary.materialsVariance[key] }))
    .filter((e) => e.stat.avgPct !== null)

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-stone-800">{option.label}</h3>

      <div>
        <p className="text-xs font-medium text-stone-500">Revenue</p>
        <p className="text-lg font-semibold text-stone-900">{fmtCurrency(summary.revenue.total)}</p>
        <p className="text-xs text-stone-400">
          {fmtCurrency(summary.revenue.invoiced)} invoiced · {fmtCurrency(summary.revenue.pipeline)} pipeline
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-stone-500">Completion</p>
        <p className="text-lg font-semibold text-stone-900">{fmtNumber(summary.completionPct, 0)}%</p>
        <p className="text-xs text-stone-400">
          {summary.completedCount} of {summary.lotCount} lots
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-stone-500">Avg lot value</p>
        <p className="text-lg font-semibold text-stone-900">{fmtCurrency(summary.avgLotValue)}</p>
      </div>

      <div>
        <p className="text-xs font-medium text-stone-500">Materials variance</p>
        {varianceEntries.length === 0 ? (
          <p className="text-sm text-stone-400">No comparable lots</p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-xs text-stone-600">
            {varianceEntries.map(({ key, stat }) => (
              <li key={key}>
                {CATEGORY_LABELS[key]}: {fmtPct(stat.avgPct!)} ({stat.n})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function ComparisonSection({ sites }: { sites: SiteAnalytics[] }) {
  const options = buildOptions(sites)
  const [keyA, setKeyA] = useState<string>('')
  const [keyB, setKeyB] = useState<string>('')

  const optionA = options.find((o) => o.key === keyA) ?? null
  const optionB = options.find((o) => o.key === keyB) ?? null

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={keyA}
          onChange={(e) => setKeyA(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700"
        >
          <option value="">Select a site or stage…</option>
          {options.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
        <select
          value={keyB}
          onChange={(e) => setKeyB(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700"
        >
          <option value="">Select a site or stage…</option>
          {options.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>

      {(optionA || optionB) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {optionA && <CompareCard option={optionA} />}
          {optionB && <CompareCard option={optionB} />}
        </div>
      )}
    </div>
  )
}
