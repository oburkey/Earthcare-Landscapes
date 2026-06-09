export default function SafetyLoading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <div className="h-7 w-24 rounded-lg bg-stone-200 animate-pulse" />
        <div className="flex gap-1">
          {[80, 90, 80].map((w, i) => (
            <div key={i} style={{ width: w }} className="h-8 rounded-lg bg-stone-200 animate-pulse" />
          ))}
        </div>
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-stone-100 animate-pulse" />
                <div className="h-3 w-64 rounded bg-stone-100 animate-pulse" />
              </div>
              <div className="h-4 w-20 rounded bg-stone-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
