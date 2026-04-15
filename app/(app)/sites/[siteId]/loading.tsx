export default function SiteLoading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Back link */}
        <div className="h-4 w-12 rounded bg-stone-200 animate-pulse" />

        {/* Site header card */}
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <div className="h-6 w-48 rounded bg-stone-200 animate-pulse mb-1.5" />
          <div className="h-4 w-64 rounded bg-stone-100 animate-pulse" />
          <div className="mt-4 pt-4 border-t border-stone-100">
            <div className="flex justify-between mb-1.5">
              <div className="h-3 w-28 rounded bg-stone-100 animate-pulse" />
              <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
            </div>
            <div className="h-2 w-full rounded-full bg-stone-100 animate-pulse" />
          </div>
        </div>

        {/* Site plan section */}
        <div>
          <div className="h-5 w-20 rounded bg-stone-200 animate-pulse mb-3" />
          <div className="rounded-xl border border-stone-200 bg-white h-40 animate-pulse" />
        </div>

        {/* Stages section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="h-5 w-16 rounded bg-stone-200 animate-pulse" />
            <div className="h-8 w-24 rounded-lg bg-stone-200 animate-pulse" />
          </div>
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 rounded bg-stone-200 animate-pulse" />
                  <div className="flex gap-1.5">
                    <div className="h-5 w-20 rounded-full bg-stone-100 animate-pulse" />
                    <div className="h-5 w-20 rounded-full bg-stone-100 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-stone-100 animate-pulse" />
                    <div className="h-3 w-8 rounded bg-stone-100 animate-pulse" />
                  </div>
                </div>
                <div className="h-4 w-4 rounded bg-stone-100 animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
