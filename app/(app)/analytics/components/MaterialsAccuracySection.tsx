import { fmtNumber, fmtPct } from '../format'
import { CATEGORY_LABELS, type AnalyticsData } from '../lib'

export default function MaterialsAccuracySection({ materials }: { materials: AnalyticsData['materials'] }) {
  const { variance, plantRatios } = materials
  const categoryKeys = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categoryKeys.map((key) => {
          const stat = variance[key]
          return (
            <div key={key} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-medium text-fg-muted">{CATEGORY_LABELS[key]}</p>
              {stat.avgPct === null ? (
                <p className="mt-1 text-sm text-fg-muted">No comparable lots</p>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-semibold text-fg">{fmtPct(stat.avgPct)}</p>
                  <p className="mt-1 text-xs text-fg-muted">
                    avg. final vs estimate, {stat.n} lot{stat.n === 1 ? '' : 's'}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-fg-secondary">Plant ratio settings vs actual</h3>
        <p className="mt-1 text-xs text-fg-muted">
          Configured ratios (from plant ratio settings) vs actual plants/m² from final quant data in this range
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-fg-muted">Front (plants / m²)</p>
            <p className="mt-1 text-lg font-semibold text-fg">
              {fmtNumber(plantRatios.configuredFront, 2)}
              <span className="px-1 text-sm font-normal text-fg-muted">configured</span>
              {plantRatios.actualFront !== null ? fmtNumber(plantRatios.actualFront, 2) : '—'}
              <span className="px-1 text-sm font-normal text-fg-muted">actual</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-fg-muted">Rear (plants / m²)</p>
            <p className="mt-1 text-lg font-semibold text-fg">
              {fmtNumber(plantRatios.configuredRear, 2)}
              <span className="px-1 text-sm font-normal text-fg-muted">configured</span>
              {plantRatios.actualRear !== null ? fmtNumber(plantRatios.actualRear, 2) : '—'}
              <span className="px-1 text-sm font-normal text-fg-muted">actual</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
