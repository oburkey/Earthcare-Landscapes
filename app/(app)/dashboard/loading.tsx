export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">

        {/* Greeting */}
        <div>
          <div className="h-7 w-52 rounded-lg bg-skeleton animate-pulse" />
          <div className="h-4 w-40 rounded bg-skeleton animate-pulse mt-1.5" />
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-surface px-3 py-3.5 space-y-2">
              <div className="h-8 w-10 rounded bg-skeleton animate-pulse" />
              <div className="h-3 w-24 rounded bg-skeleton animate-pulse" />
            </div>
          ))}
        </div>

        {/* Fortnight calendar */}
        <div>
          <div className="h-5 w-28 rounded bg-skeleton animate-pulse mb-3" />
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-surface-raised">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="px-1 py-1.5 flex justify-center">
                  <div className="h-3 w-6 rounded bg-skeleton animate-pulse" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-b border-border-subtle">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="min-h-[72px] border-r border-border-subtle last:border-r-0 p-1">
                  <div className="h-3 w-4 rounded bg-skeleton animate-pulse mb-1" />
                  <div className="h-3 w-full rounded bg-skeleton animate-pulse" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="min-h-[72px] border-r border-border-subtle last:border-r-0 p-1">
                  <div className="h-3 w-4 rounded bg-skeleton animate-pulse mb-1" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Extra jobs */}
        <div>
          <div className="h-5 w-44 rounded bg-skeleton animate-pulse mb-3" />
          <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-5 w-8 rounded bg-skeleton animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-40 rounded bg-skeleton animate-pulse" />
                  <div className="h-3 w-24 rounded bg-skeleton animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded-full bg-skeleton animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
