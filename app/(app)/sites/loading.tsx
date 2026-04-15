export default function SitesLoading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="h-7 w-16 rounded-lg bg-stone-200 animate-pulse" />
          <div className="h-9 w-24 rounded-lg bg-stone-200 animate-pulse" />
        </div>

        {/* Sites list */}
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-40 rounded bg-stone-200 animate-pulse" />
                <div className="h-3 w-52 rounded bg-stone-100 animate-pulse" />
                <div className="flex items-center gap-3 mt-1">
                  <div className="h-3 w-16 rounded bg-stone-100 animate-pulse" />
                  <div className="h-1.5 w-24 rounded-full bg-stone-100 animate-pulse" />
                </div>
              </div>
              <div className="h-4 w-4 rounded bg-stone-100 animate-pulse shrink-0" />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
