'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { RevenueMonthPoint } from '../lib'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

export default function RevenueChart({ monthly }: { monthly: RevenueMonthPoint[] }) {
  if (monthly.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-800">Revenue over time</h3>
        <p className="mt-4 text-sm text-stone-400">No lots due in this range.</p>
      </div>
    )
  }

  const data = {
    labels: monthly.map((m) => m.label),
    datasets: [
      {
        label: 'Invoiced',
        data: monthly.map((m) => m.invoiced),
        backgroundColor: '#15803d',
      },
      {
        label: 'Pipeline',
        data: monthly.map((m) => m.pipeline),
        backgroundColor: '#d6d3d1',
      },
    ],
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-800">Revenue over time</h3>
      <p className="mt-1 text-xs text-stone-400">Invoiced vs pipeline, by due date month</p>
      <div className="mt-3 h-64">
        <Bar
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { stacked: true },
              y: { stacked: true, ticks: { callback: (v) => `$${Number(v).toLocaleString()}` } },
            },
            plugins: {
              legend: { position: 'bottom' },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString()}`,
                },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
