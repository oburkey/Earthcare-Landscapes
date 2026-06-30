export default function SiteLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Back link */}
        <div className="h-4 w-12 rounded bg-skeleton animate-pulse" />

        {/* Site header card */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="h-6 w-48 rounded bg-skeleton animate-pulse mb-1.5" />
          <div className="h-4 w-64 rounded bg-skeleton animate-pulse" />
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <div className="flex justify-between mb-1.5">
              <div className="h-3 w-28 rounded bg-skeleton animate-pulse" />
              <div className="h-3 w-24 rounded bg-skeleton animate-pulse" />
            </div>
            <div className="h-2 w-full rounded-full bg-skeleton animate-pulse" />
          </div>
        </div>

        {/* Site plan section */}
        <div>
          <div className="h-5 w-20 rounded bg-skeleton animate-pulse mb-3" />
          <div className="rounded-xl border border-border bg-surface h-40 animate-pulse" />
        </div>

        {/* Stages section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="h-5 w-16 rounded bg-skeleton animate-pulse" />
            <div className="h-8 w-24 rounded-lg bg-skeleton animate-pulse" />
          </div>
          <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 rounded bg-skeleton animate-pulse" />
                  <div className="flex gap-1.5">
                    <div className="h-5 w-20 rounded-full bg-skeleton animate-pulse" />
                    <div className="h-5 w-20 rounded-full bg-skeleton animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-skeleton animate-pulse" />
                    <div className="h-3 w-8 rounded bg-skeleton animate-pulse" />
                  </div>
                </div>
                <div className="h-4 w-4 rounded bg-skeleton animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
