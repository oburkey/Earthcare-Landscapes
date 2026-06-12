export default function PlantRatiosLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <div className="h-7 w-40 rounded bg-stone-200 animate-pulse" />
        <div className="h-4 w-96 rounded bg-stone-100 animate-pulse" />
      </div>

      {/* Global default card */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <div className="h-4 w-32 rounded bg-stone-200 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-9 rounded bg-stone-100 animate-pulse" />
          <div className="h-9 rounded bg-stone-100 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-9 rounded bg-stone-100 animate-pulse" />
          <div className="h-9 rounded bg-stone-100 animate-pulse" />
        </div>
        <div className="h-9 w-32 rounded bg-stone-200 animate-pulse" />
      </div>

      {/* Site overrides card */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <div className="h-4 w-32 rounded bg-stone-200 animate-pulse" />
        <div className="h-4 w-64 rounded bg-stone-100 animate-pulse" />
      </div>
    </div>
  )
}
