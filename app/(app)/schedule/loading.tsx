export default function ScheduleLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        <div className="h-7 w-24 rounded bg-skeleton animate-pulse" />

        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-52 rounded bg-skeleton animate-pulse" />
            </div>
            <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-20 rounded bg-skeleton animate-pulse" />
                      <div className="h-5 w-16 rounded-full bg-skeleton animate-pulse" />
                    </div>
                    <div className="h-3 w-36 rounded bg-skeleton animate-pulse" />
                  </div>
                  <div className="h-3 w-16 rounded bg-skeleton animate-pulse shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  )
}
