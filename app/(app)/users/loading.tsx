export default function UsersLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-8">

        {/* Page title */}
        <div className="h-7 w-44 rounded-lg bg-skeleton animate-pulse" />

        {/* Invite by email */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-28 rounded bg-skeleton animate-pulse" />
            <div className="h-3.5 w-16 rounded bg-skeleton animate-pulse" />
          </div>
        </div>

        {/* Pending invitations */}
        <div className="space-y-3">
          <div className="h-3.5 w-40 rounded bg-skeleton animate-pulse" />
          <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
            {[0, 1].map(i => (
              <div key={i} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-44 rounded bg-skeleton animate-pulse" />
                  <div className="h-3 w-56 rounded bg-skeleton animate-pulse" />
                </div>
                <div className="flex gap-2 shrink-0">
                  <div className="h-7 w-16 rounded-lg bg-skeleton animate-pulse" />
                  <div className="h-7 w-14 rounded-lg bg-skeleton animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff without app access */}
        <div className="space-y-3">
          <div className="h-3.5 w-48 rounded bg-skeleton animate-pulse" />
          <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-32 rounded bg-skeleton animate-pulse" />
                  <div className="h-3 w-40 rounded bg-skeleton animate-pulse" />
                </div>
                <div className="h-7 w-20 rounded-lg bg-skeleton animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Active users */}
        <div className="space-y-3">
          <div className="h-3.5 w-28 rounded bg-skeleton animate-pulse" />
          <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-36 rounded bg-skeleton animate-pulse" />
                  <div className="h-3 w-48 rounded bg-skeleton animate-pulse" />
                </div>
                <div className="h-7 w-14 rounded-lg bg-skeleton animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
