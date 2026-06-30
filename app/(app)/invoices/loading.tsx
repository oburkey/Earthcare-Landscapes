export default function InvoicesLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
        {/* Header */}
        <div className="h-7 w-24 rounded-lg bg-skeleton animate-pulse" />

        {/* Site cards */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex-1 space-y-1.5">
                <div className="h-5 w-44 rounded bg-skeleton animate-pulse" />
                <div className="h-3 w-28 rounded bg-surface-raised animate-pulse" />
              </div>
              <div className="h-3 w-32 rounded bg-surface-raised animate-pulse shrink-0" />
            </div>
            <div className="border-t border-border-subtle">
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="h-3.5 w-3.5 rounded bg-surface-raised animate-pulse shrink-0" />
                <div className="h-4 w-24 rounded bg-skeleton animate-pulse" />
                <div className="h-3 w-36 rounded bg-surface-raised animate-pulse" />
              </div>
              <div className="px-5 pb-4">
                <div className="overflow-x-auto">
                  <div className="space-y-1">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="flex items-center gap-3 py-2.5">
                        <div className="h-4 w-4 rounded bg-surface-raised animate-pulse shrink-0" />
                        <div className="h-4 w-20 rounded bg-skeleton animate-pulse" />
                        <div className="flex-1" />
                        <div className="h-4 w-16 rounded bg-surface-raised animate-pulse" />
                        <div className="h-4 w-16 rounded bg-surface-raised animate-pulse" />
                        <div className="h-4 w-20 rounded bg-skeleton animate-pulse" />
                        <div className="h-6 w-16 rounded-full bg-surface-raised animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
