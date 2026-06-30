import RevenueOverviewSection from './components/RevenueOverviewSection'
import RevenueChart from './components/RevenueChart'
import LotsCompletedChart from './components/LotsCompletedChart'
import MaterialsAccuracySection from './components/MaterialsAccuracySection'
import VarianceTrendChart from './components/VarianceTrendChart'
import DrillDownSection from './components/DrillDownSection'
import ComparisonSection from './components/ComparisonSection'
import type { AnalyticsData } from './lib'

export default function AnalyticsView({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-fg">Revenue overview</h2>
          <p className="text-xs text-fg-muted">
            Providence-style per-lot pricing only. Sites or lots without lot quote data are excluded from these
            figures (not shown as $0).
          </p>
        </div>
        <RevenueOverviewSection revenue={data.revenue} />
        <div className="grid gap-4 lg:grid-cols-2">
          <RevenueChart monthly={data.revenue.monthly} />
          <LotsCompletedChart data={data.revenue.completedPerMonth} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-fg">Materials & quote accuracy</h2>
        <MaterialsAccuracySection materials={data.materials} />
        <VarianceTrendChart trend={data.materials.trend} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-fg">Site drill-down</h2>
        <DrillDownSection sites={data.sites} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-fg">Compare</h2>
        <ComparisonSection sites={data.sites} />
      </section>
    </div>
  )
}
