import { fmtNumber, fmtPct } from '../format'
import { type AnalyticsData, type PlantSize } from '../lib'

const PLANT_SIZE_LABELS: Record<PlantSize, string> = {
  '130/140mm plants': '130/140mm',
  '200mm plants': '200mm',
  '300mm plants': '300mm',
}

// Signed quantity for the variance column, e.g. "+14" / "-3" — fmtNumber
// already renders the "-" for negatives via toLocaleString, so only the "+"
// for positives needs adding here.
function signedQty(n: number): string {
  const formatted = fmtNumber(n, 1)
  return n > 0 ? `+${formatted}` : formatted
}

export default function MaterialsAccuracySection({
  materials, isAdmin,
}: {
  materials: AnalyticsData['materials']
  isAdmin: boolean
}) {
  const { plantRatios, plantBreakdown, accuracyRows, lotCount } = materials

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h3 className="text-sm font-semibold text-fg-secondary">Materials accuracy — estimate vs final</h3>
        </div>
        {accuracyRows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-fg-muted">No comparable lots.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-fg-muted">
                    <th className="text-left font-medium px-4 py-2">Material</th>
                    <th className="text-right font-medium px-2 py-2">Estimate</th>
                    <th className="text-right font-medium px-2 py-2">Final</th>
                    <th className="text-right font-medium px-2 py-2 pr-4">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {accuracyRows.map((row) => (
                    <tr key={row.key} className="border-t border-border-subtle">
                      <td className="px-4 py-2 text-fg-secondary">{row.label}</td>
                      <td className="px-2 py-2 text-right text-fg-muted">
                        {fmtNumber(row.estimateQty, 1)} {row.unit}
                      </td>
                      <td className="px-2 py-2 text-right text-fg-muted">
                        {fmtNumber(row.finalQty, 1)} {row.unit}
                      </td>
                      <td className="px-2 py-2 pr-4 text-right">
                        <span className={row.variance <= 0 ? 'text-green-700' : 'text-red-600'}>
                          {signedQty(row.variance)} {row.unit}
                          {row.variancePct != null && (
                            <span className="ml-1 text-fg-muted">({fmtPct(row.variancePct, 0)})</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2 text-xs text-fg-muted border-t border-border-subtle">
              {lotCount === 1 ? 'Exact values — 1 lot' : `Averaged across ${lotCount} lot${lotCount === 1 ? '' : 's'}`}
            </p>
          </>
        )}
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

      {plantBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-fg-secondary">Plant breakdown</h3>
          <p className="mt-1 text-xs text-fg-muted">
            Plant counts by pot size, front and rear combined — estimate vs budget vs final, this range.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-fg-muted">
                  <th className="text-left font-medium py-2 pr-2">Plant size</th>
                  {isAdmin && <th className="text-right font-medium py-2 px-2">Estimate</th>}
                  <th className="text-right font-medium py-2 px-2">Budget</th>
                  <th className="text-right font-medium py-2 px-2">Final</th>
                  <th className="text-right font-medium py-2 pl-2">Budget vs Final</th>
                </tr>
              </thead>
              <tbody>
                {plantBreakdown.map((row) => (
                  <tr key={row.size} className="border-t border-border-subtle">
                    <td className="py-2 pr-2 text-fg-secondary">{PLANT_SIZE_LABELS[row.size]}</td>
                    {isAdmin && (
                      <td className="py-2 px-2 text-right text-fg-muted">
                        {row.estimateQty !== null ? fmtNumber(row.estimateQty, 0) : '—'}
                      </td>
                    )}
                    <td className="py-2 px-2 text-right text-fg-muted">
                      {row.budgetQty !== null ? fmtNumber(row.budgetQty, 0) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right text-fg-muted">
                      {row.finalQty !== null ? fmtNumber(row.finalQty, 0) : '—'}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      {row.budgetVsFinalPct !== null ? (
                        <span className={row.budgetVsFinalPct <= 0 ? 'text-green-700' : 'text-red-600'}>
                          {fmtPct(row.budgetVsFinalPct, 0)}
                        </span>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
