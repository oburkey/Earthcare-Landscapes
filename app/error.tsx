'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-stone-800">Something went wrong</h2>
          <p className="text-sm text-stone-500">An unexpected error occurred. Please try again.</p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-800 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
