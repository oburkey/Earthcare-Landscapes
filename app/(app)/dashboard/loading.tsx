export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">

        {/* Greeting */}
        <div>
          <div className="h-7 w-52 rounded-lg bg-stone-200 animate-pulse" />
          <div className="h-4 w-40 rounded bg-stone-100 animate-pulse mt-1.5" />
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white px-3 py-3.5 space-y-2">
              <div className="h-8 w-10 rounded bg-stone-200 animate-pulse" />
              <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Fortnight calendar */}
        <div>
          <div className="h-5 w-28 rounded bg-stone-200 animate-pulse mb-3" />
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="px-1 py-1.5 flex justify-center">
                  <div className="h-3 w-6 rounded bg-stone-200 animate-pulse" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-b border-stone-100">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="min-h-[72px] border-r border-stone-100 last:border-r-0 p-1">
                  <div className="h-3 w-4 rounded bg-stone-100 animate-pulse mb-1" />
                  <div className="h-3 w-full rounded bg-stone-50 animate-pulse" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="min-h-[72px] border-r border-stone-100 last:border-r-0 p-1">
                  <div className="h-3 w-4 rounded bg-stone-100 animate-pulse mb-1" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Extra jobs */}
        <div>
          <div className="h-5 w-44 rounded bg-stone-200 animate-pulse mb-3" />
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-5 w-8 rounded bg-stone-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-40 rounded bg-stone-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded-full bg-stone-100 animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
