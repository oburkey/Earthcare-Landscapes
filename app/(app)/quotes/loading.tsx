export default function QuotesLoading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="h-7 w-20 rounded-lg bg-stone-200 animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-stone-200 animate-pulse" />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {[50, 55, 45, 70].map((w, i) => (
            <div key={i} style={{ width: w }} className="h-8 rounded-lg bg-stone-200 animate-pulse" />
          ))}
        </div>

        {/* Quote list */}
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-4 w-4 rounded bg-stone-100 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-32 rounded bg-stone-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
                </div>
                <div className="h-3 w-56 rounded bg-stone-100 animate-pulse" />
              </div>
              <div className="h-3 w-16 rounded bg-stone-100 animate-pulse shrink-0 hidden sm:block" />
              <div className="h-4 w-16 rounded bg-stone-200 animate-pulse shrink-0" />
              <div className="h-6 w-16 rounded-full bg-stone-100 animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
