export default function StaffLoading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-16 rounded bg-stone-200 animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-stone-200 animate-pulse" />
        </div>

        {/* Staff list */}
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5 gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-36 rounded bg-stone-200 animate-pulse" />
                <div className="flex items-center gap-2">
                  <div className="h-5 w-20 rounded-full bg-stone-100 animate-pulse" />
                  <div className="h-3 w-28 rounded bg-stone-100 animate-pulse" />
                </div>
              </div>
              <div className="h-8 w-12 rounded-lg bg-stone-100 animate-pulse shrink-0" />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
