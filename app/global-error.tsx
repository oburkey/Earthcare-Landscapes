'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', padding: '2rem', background: '#fafaf9' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1c1917' }}>
          Something went wrong
        </h2>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#78716c' }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#15803d',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
