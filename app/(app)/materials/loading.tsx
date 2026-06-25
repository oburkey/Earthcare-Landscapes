export default function MaterialsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="h-7 w-28 rounded-lg bg-stone-200 animate-pulse" />
        <div className="h-4 w-80 rounded bg-stone-100 animate-pulse mt-2" />
      </div>

      {/* Month cards */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="px-5 py-3.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <div className="h-5 w-32 rounded bg-stone-200 animate-pulse" />
            <div className="h-4 w-20 rounded bg-stone-100 animate-pulse" />
          </div>
          <div className="divide-y divide-stone-100">
            {[0, 1].map((j) => (
              <div key={j} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-40 rounded bg-stone-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((k) => (
                    <div key={k} className="h-3 rounded bg-stone-100 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
