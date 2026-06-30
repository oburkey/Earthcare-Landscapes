export default function MaterialsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="h-7 w-28 rounded-lg bg-skeleton animate-pulse" />
        <div className="h-4 w-80 rounded bg-surface-raised animate-pulse mt-2" />
      </div>

      {/* Month cards */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-5 py-3.5 bg-surface-raised border-b border-border flex items-center justify-between">
            <div className="h-5 w-32 rounded bg-skeleton animate-pulse" />
            <div className="h-4 w-20 rounded bg-surface-raised animate-pulse" />
          </div>
          <div className="divide-y divide-border-subtle">
            {[0, 1].map((j) => (
              <div key={j} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-40 rounded bg-skeleton animate-pulse" />
                  <div className="h-3 w-24 rounded bg-surface-raised animate-pulse" />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((k) => (
                    <div key={k} className="h-3 rounded bg-surface-raised animate-pulse" />
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
