export default function LotLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="h-4 w-10 rounded bg-skeleton animate-pulse" />
          <div className="h-3 w-2 rounded bg-skeleton animate-pulse" />
          <div className="h-4 w-20 rounded bg-skeleton animate-pulse" />
          <div className="h-3 w-2 rounded bg-skeleton animate-pulse" />
          <div className="h-4 w-20 rounded bg-skeleton animate-pulse" />
          <div className="h-3 w-2 rounded bg-skeleton animate-pulse" />
          <div className="h-4 w-12 rounded bg-skeleton animate-pulse" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-7 w-20 rounded bg-skeleton animate-pulse" />
          <div className="h-6 w-24 rounded-full bg-skeleton animate-pulse" />
        </div>

        {/* Info card */}
        <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
          {['Site', 'Stage', 'Due date', 'Scheduled'].map((label) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="h-4 w-16 rounded bg-skeleton animate-pulse" />
              <div className="h-4 w-28 rounded bg-skeleton animate-pulse" />
            </div>
          ))}
        </div>

        {/* Quantities section */}
        <div>
          <div className="h-5 w-24 rounded bg-skeleton animate-pulse mb-3" />
          <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="h-4 w-40 rounded bg-skeleton animate-pulse" />
                <div className="h-4 w-16 rounded bg-skeleton animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Photos section */}
        <div>
          <div className="h-5 w-16 rounded bg-skeleton animate-pulse mb-3" />
          <div className="rounded-xl border border-border bg-surface p-5 mb-4">
            <div className="h-10 w-full rounded-lg bg-skeleton animate-pulse" />
          </div>
        </div>

        {/* Documents section */}
        <div>
          <div className="h-5 w-24 rounded bg-skeleton animate-pulse mb-3" />
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="h-10 w-full rounded-lg bg-skeleton animate-pulse" />
          </div>
        </div>

      </div>
    </div>
  )
}
