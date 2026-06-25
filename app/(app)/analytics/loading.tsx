export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="h-7 w-28 rounded-lg bg-stone-200 animate-pulse" />
          <div className="h-4 w-72 rounded bg-stone-100 animate-pulse mt-2" />
        </div>
        <div className="text-right space-y-1">
          <div className="h-8 w-40 rounded-lg bg-stone-200 animate-pulse ml-auto" />
          <div className="h-3 w-56 rounded bg-stone-100 animate-pulse ml-auto" />
        </div>
      </div>

      {/* Revenue cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
            <div className="h-3 w-28 rounded bg-stone-100 animate-pulse" />
            <div className="h-8 w-24 rounded bg-stone-200 animate-pulse" />
            <div className="h-3 w-20 rounded bg-stone-100 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-36 rounded bg-stone-200 animate-pulse mb-4" />
        <div className="h-48 rounded-lg bg-stone-50 animate-pulse" />
      </div>

      {/* Materials variance */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-44 rounded bg-stone-200 animate-pulse mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1.5 p-3 rounded-lg bg-stone-50">
              <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
              <div className="h-5 w-16 rounded bg-stone-200 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Drill-down */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="px-5 py-4">
          <div className="h-4 w-32 rounded bg-stone-200 animate-pulse" />
        </div>
        <div className="border-t border-stone-100 divide-y divide-stone-100">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="h-4 w-36 rounded bg-stone-200 animate-pulse" />
              <div className="flex-1" />
              <div className="h-3 w-20 rounded bg-stone-100 animate-pulse" />
              <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
