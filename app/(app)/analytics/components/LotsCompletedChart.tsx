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

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

export default function LotsCompletedChart({ data }: { data: CompletionMonthPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-800">Lots completed per month</h3>
        <p className="mt-4 text-sm text-stone-400">No lots marked build-complete in this range.</p>
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
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-800">Lots completed per month</h3>
      <p className="mt-1 text-xs text-stone-400">By build-complete date</p>
      <div className="mt-3 h-64">
        <Bar
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { ticks: { precision: 0 } } },
            plugins: { legend: { display: false } },
          }}
        />
      </div>
    </div>
  )
}
