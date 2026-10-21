export default function FilesLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        <div className="space-y-1.5">
          <div className="h-7 w-20 rounded bg-skeleton animate-pulse" />
          <div className="h-4 w-64 rounded bg-skeleton animate-pulse" />
        </div>
        <div className="h-12 rounded-xl border border-border bg-surface animate-pulse" />
        <div className="h-28 rounded-xl border border-border bg-surface animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-skeleton animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
