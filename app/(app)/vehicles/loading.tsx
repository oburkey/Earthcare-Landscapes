export default function VehiclesLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-20 rounded bg-skeleton animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-skeleton animate-pulse" />
        </div>

        {/* Vehicles list */}
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-5 w-40 rounded bg-skeleton animate-pulse" />
                  <div className="h-3 w-24 rounded bg-skeleton animate-pulse" />
                </div>
                <div className="h-8 w-12 rounded-lg bg-skeleton animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="h-4 w-full rounded bg-skeleton animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
