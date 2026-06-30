'use client'

import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { CATEGORY_LABELS, type VarianceTrendPoint } from '../lib'
import { useChartTheme } from '../useChartTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const CATEGORY_COLORS: Record<keyof typeof CATEGORY_LABELS, string> = {
  turf: '#15803d',
  gardenBedFront: '#b45309',
  gardenBedRear: '#a16207',
  edging: '#0369a1',
  plantsFront: '#7c3aed',
  plantsRear: '#be185d',
}

export default function VarianceTrendChart({ trend }: { trend: VarianceTrendPoint[] }) {
  const theme = useChartTheme()
  const hasData = trend.some((m) => Object.keys(CATEGORY_LABELS).some((k) => m[k as keyof typeof CATEGORY_LABELS] !== null))

  if (trend.length === 0 || !hasData) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-fg-secondary">Variance trend</h3>
        <p className="mt-4 text-sm text-fg-muted">
          No lots with both estimate and final quant data in this range.
        </p>
      </div>
    )
  }

  const data = {
    labels: trend.map((m) => m.label),
    datasets: (Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map((key) => ({
      label: CATEGORY_LABELS[key],
      data: trend.map((m) => m[key]),
      borderColor: CATEGORY_COLORS[key],
      backgroundColor: CATEGORY_COLORS[key],
      spanGaps: true,
      tension: 0.2,
    })),
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-fg-secondary">Variance trend</h3>
      <p className="mt-1 text-xs text-fg-muted">Average % difference (final vs estimate), by due date month</p>
      <div className="mt-3 h-64">
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { grid: { color: theme.grid }, ticks: { color: theme.ticks } },
              y: { grid: { color: theme.grid }, ticks: { color: theme.ticks, callback: (v) => `${v}%` } },
            },
            plugins: {
              legend: { position: 'bottom', labels: { color: theme.legend } },
              tooltip: {
                ...theme.tooltip,
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y == null ? '—' : `${Number(ctx.parsed.y).toFixed(1)}%`}`,
                },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
