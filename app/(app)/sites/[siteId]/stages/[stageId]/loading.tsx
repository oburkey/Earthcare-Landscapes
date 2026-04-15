export default function StageLoading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-10 rounded bg-stone-200 animate-pulse" />
          <div className="h-3 w-2 rounded bg-stone-200 animate-pulse" />
          <div className="h-4 w-20 rounded bg-stone-200 animate-pulse" />
          <div className="h-3 w-2 rounded bg-stone-200 animate-pulse" />
          <div className="h-4 w-16 rounded bg-stone-200 animate-pulse" />
        </div>

        {/* Stage header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="h-7 w-40 rounded bg-stone-200 animate-pulse" />
            <div className="h-4 w-28 rounded bg-stone-100 animate-pulse" />
          </div>
          <div className="h-9 w-24 rounded-lg bg-stone-200 animate-pulse shrink-0" />
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-stone-100 animate-pulse" />

        {/* Stage plan */}
        <div>
          <div className="h-5 w-24 rounded bg-stone-200 animate-pulse mb-3" />
          <div className="rounded-xl border border-stone-200 bg-white h-32 animate-pulse" />
        </div>

        {/* Lots section */}
        <div>
          <div className="h-5 w-12 rounded bg-stone-200 animate-pulse mb-3" />
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-16 rounded bg-stone-200 animate-pulse" />
                    <div className="h-5 w-20 rounded-full bg-stone-100 animate-pulse" />
                  </div>
                  <div className="h-3 w-28 rounded bg-stone-100 animate-pulse" />
                </div>
                <div className="h-4 w-4 rounded bg-stone-100 animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Extra jobs section */}
        <div>
          <div className="h-5 w-24 rounded bg-stone-200 animate-pulse mb-3" />
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center">
            <div className="h-4 w-32 rounded bg-stone-100 animate-pulse mx-auto" />
          </div>
        </div>

      </div>
    </div>
  )
}
