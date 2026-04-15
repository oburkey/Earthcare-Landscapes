export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">

        {/* Greeting */}
        <div className="h-7 w-52 rounded-lg bg-stone-200 animate-pulse" />

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white px-3 py-3.5 space-y-2">
              <div className="h-8 w-10 rounded bg-stone-200 animate-pulse" />
              <div className="h-3 w-20 rounded bg-stone-100 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Upcoming deadlines */}
        <section>
          <div className="h-5 w-44 rounded bg-stone-200 animate-pulse mb-3" />
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            {[0, 1].map((i) => (
              <div key={i} className="px-4 py-3 border-b border-stone-100 last:border-b-0">
                <div className="h-3.5 w-28 rounded bg-stone-200 animate-pulse mb-2" />
                <div className="flex gap-2 flex-wrap">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="h-8 w-24 rounded-lg bg-stone-100 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Active sites */}
        <section>
          <div className="h-5 w-28 rounded bg-stone-200 animate-pulse mb-3" />
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-4 py-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-4 w-36 rounded bg-stone-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
                </div>
                <div className="h-2 w-full rounded-full bg-stone-100 animate-pulse" />
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
