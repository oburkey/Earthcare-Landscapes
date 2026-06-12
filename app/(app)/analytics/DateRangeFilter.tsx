import Link from 'next/link'
import { RANGE_OPTIONS, type RangeKey } from './lib'

export default function DateRangeFilter({ current }: { current: RangeKey }) {
  return (
    <div className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1">
      {RANGE_OPTIONS.map((opt) => (
        <Link
          key={opt.key}
          href={`/analytics?range=${opt.key}`}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            current === opt.key
              ? 'bg-green-700 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  )
}
