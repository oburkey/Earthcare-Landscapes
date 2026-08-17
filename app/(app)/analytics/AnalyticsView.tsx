'use client'

import { useState } from 'react'
import RevenueOverviewSection from './components/RevenueOverviewSection'
import RevenueChart from './components/RevenueChart'
import LotsCompletedChart from './components/LotsCompletedChart'
import MaterialsAccuracyPanel, { type Selection } from './components/MaterialsAccuracyPanel'
import DrillDownSection from './components/DrillDownSection'
import ComparisonSection from './components/ComparisonSection'
import type { AnalyticsData } from './lib'

export default function AnalyticsView({ data, isAdmin }: { data: AnalyticsData; isAdmin: boolean }) {
  // Lifted here (rather than owned by MaterialsAccuracyPanel) so a
  // site/stage selection in the accuracy filter can also drive
  // DrillDownSection's auto-expand below — both read from the same state.
  const [selection, setSelection] = useState<Selection>({ type: 'all' })
  const focusSiteId  = selection.type === 'all' ? null : selection.siteId
  const focusStageId = selection.type === 'stage' || selection.type === 'lot' ? selection.stageId : null

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
        <MaterialsAccuracyPanel
          global={data.materials}
          bySite={data.materialsBySite}
          byStage={data.materialsByStage}
          byLot={data.materialsByLot}
          siteIndex={data.materialsSiteIndex}
          selection={selection}
          onSelectionChange={setSelection}
          isAdmin={isAdmin}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-fg">Site drill-down</h2>
        <DrillDownSection sites={data.sites} focusSiteId={focusSiteId} focusStageId={focusStageId} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-fg">Compare</h2>
        <ComparisonSection sites={data.sites} />
      </section>
    </div>
  )
}
