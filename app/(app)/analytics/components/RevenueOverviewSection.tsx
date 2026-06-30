import { fmtCurrency, fmtPct } from '../format'
import type { AnalyticsData } from '../lib'

export default function RevenueOverviewSection({ revenue }: { revenue: AnalyticsData['revenue'] }) {
  const { invoiced, pipeline, avgComparison, excludedLotsCount } = revenue

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-fg-muted">Invoiced revenue</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{fmtCurrency(invoiced.total)}</p>
          <p className="mt-1 text-xs text-fg-muted">
            {invoiced.count} of {invoiced.eligible} lots invoiced
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-fg-muted">Estimated pipeline</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{fmtCurrency(pipeline.total)}</p>
          <p className="mt-1 text-xs text-fg-muted">
            {pipeline.count} of {pipeline.eligible} lots
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-fg-muted">Avg invoiced vs estimated</p>
          {avgComparison ? (
            <>
              <p className="mt-1 text-lg font-semibold text-fg">
                {fmtCurrency(avgComparison.avgInvoiced)}
                <span className="px-1 text-sm font-normal text-fg-muted">vs</span>
                {fmtCurrency(avgComparison.avgEstimated)}
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                {fmtPct(avgComparison.pctDiff)} ({avgComparison.n} lot{avgComparison.n === 1 ? '' : 's'})
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-fg-muted">No comparable lots in this range.</p>
          )}
        </div>
      </div>

      {excludedLotsCount > 0 && (
        <p className="text-xs text-fg-muted">
          {excludedLotsCount} lot{excludedLotsCount === 1 ? '' : 's'} due in this range excluded from revenue —
          no Providence pricing data.
        </p>
      )}
    </div>
  )
}
