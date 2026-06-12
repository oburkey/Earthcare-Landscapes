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
            <div key={key} className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-xs font-medium text-stone-500">{CATEGORY_LABELS[key]}</p>
              {stat.avgPct === null ? (
                <p className="mt-1 text-sm text-stone-400">No comparable lots</p>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-semibold text-stone-900">{fmtPct(stat.avgPct)}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    avg. final vs estimate, {stat.n} lot{stat.n === 1 ? '' : 's'}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-800">Plant ratio settings vs actual</h3>
        <p className="mt-1 text-xs text-stone-400">
          Configured ratios (from plant ratio settings) vs actual plants/m² from final quant data in this range
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-stone-500">Front (plants / m²)</p>
            <p className="mt-1 text-lg font-semibold text-stone-900">
              {fmtNumber(plantRatios.configuredFront, 2)}
              <span className="px-1 text-sm font-normal text-stone-400">configured</span>
              {plantRatios.actualFront !== null ? fmtNumber(plantRatios.actualFront, 2) : '—'}
              <span className="px-1 text-sm font-normal text-stone-400">actual</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500">Rear (plants / m²)</p>
            <p className="mt-1 text-lg font-semibold text-stone-900">
              {fmtNumber(plantRatios.configuredRear, 2)}
              <span className="px-1 text-sm font-normal text-stone-400">configured</span>
              {plantRatios.actualRear !== null ? fmtNumber(plantRatios.actualRear, 2) : '—'}
              <span className="px-1 text-sm font-normal text-stone-400">actual</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
