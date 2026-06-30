export default function ContactsLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-24 rounded bg-skeleton animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-skeleton animate-pulse" />
        </div>

        {/* Search bar placeholder */}
        <div className="h-10 w-full rounded-lg bg-skeleton animate-pulse mb-3" />

        {/* Contacts list */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5 gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-36 rounded bg-skeleton animate-pulse" />
                <div className="h-3 w-24 rounded bg-skeleton animate-pulse" />
              </div>
              <div className="h-4 w-16 rounded bg-skeleton animate-pulse shrink-0" />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
