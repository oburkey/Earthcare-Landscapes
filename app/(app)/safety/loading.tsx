export default function SafetyLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <div className="h-7 w-24 rounded-lg bg-skeleton animate-pulse" />
        <div className="flex gap-1">
          {[80, 90, 80].map((w, i) => (
            <div key={i} style={{ width: w }} className="h-8 rounded-lg bg-skeleton animate-pulse" />
          ))}
        </div>
        <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-skeleton animate-pulse" />
                <div className="h-3 w-64 rounded bg-skeleton animate-pulse" />
              </div>
              <div className="h-4 w-20 rounded bg-skeleton animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
