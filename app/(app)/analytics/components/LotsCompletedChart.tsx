'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'
import type { CompletionMonthPoint } from '../lib'
import { useChartTheme } from '../useChartTheme'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

export default function LotsCompletedChart({ data }: { data: CompletionMonthPoint[] }) {
  const theme = useChartTheme()
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-fg-secondary">Lots completed per month</h3>
        <p className="mt-4 text-sm text-fg-muted">No lots marked build-complete in this range.</p>
      </div>
    )
  }

  const chartData = {
    labels: data.map((m) => m.label),
    datasets: [
      {
        label: 'Lots completed',
        data: data.map((m) => m.count),
        backgroundColor: '#15803d',
      },
    ],
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-fg-secondary">Lots completed per month</h3>
      <p className="mt-1 text-xs text-fg-muted">By build-complete date</p>
      <div className="mt-3 h-64">
        <Bar
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { grid: { color: theme.grid }, ticks: { color: theme.ticks } },
              y: { grid: { color: theme.grid }, ticks: { color: theme.ticks, precision: 0 } },
            },
            plugins: { legend: { display: false }, tooltip: { ...theme.tooltip } },
          }}
        />
      </div>
    </div>
  )
}
