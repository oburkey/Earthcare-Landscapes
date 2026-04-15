export default function MaterialsSettingsLoading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">

        {/* Header */}
        <div className="space-y-1">
          <div className="h-7 w-48 rounded bg-stone-200 animate-pulse" />
          <div className="h-4 w-80 rounded bg-stone-100 animate-pulse" />
        </div>

        {/* Section cards */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200">
              <div className="h-5 w-8 rounded bg-stone-200 animate-pulse" />
              <div className="flex-1 h-5 w-32 rounded bg-stone-200 animate-pulse" />
              <div className="h-6 w-16 rounded bg-stone-100 animate-pulse" />
              <div className="h-6 w-16 rounded bg-stone-100 animate-pulse" />
            </div>
            {/* Column headers */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-stone-50 border-b border-stone-100">
              <div className="w-9 shrink-0" />
              <div className="flex-1 h-3 w-8 rounded bg-stone-100 animate-pulse" />
              <div className="w-14 h-3 rounded bg-stone-100 animate-pulse" />
              <div className="w-16 h-3 rounded bg-stone-100 animate-pulse" />
              <div className="w-24 shrink-0" />
            </div>
            {/* Item rows */}
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="px-4 py-2.5 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-16 rounded bg-stone-100 animate-pulse shrink-0" />
                  <div className="flex-1 h-4 rounded bg-stone-200 animate-pulse" />
                  <div className="hidden sm:block w-14 h-4 rounded bg-stone-100 animate-pulse" />
                  <div className="hidden sm:block w-16 h-4 rounded bg-stone-100 animate-pulse" />
                  <div className="hidden sm:flex w-24 gap-1">
                    <div className="h-6 w-10 rounded bg-stone-100 animate-pulse" />
                    <div className="h-6 w-12 rounded bg-stone-100 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

      </div>
    </div>
  )
}
