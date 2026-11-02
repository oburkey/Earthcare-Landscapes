'use client'

import { useEffect, type ReactNode } from 'react'

// Shared modal shell. Bottom sheet on phones, centred card from sm up.
// Height is capped with dvh (not vh — iOS Safari's toolbar breaks vh) and only
// the body scrolls, so the header and footer (save buttons) are always reachable.

const WIDTHS = {
  md:    'sm:max-w-md',
  lg:    'sm:max-w-lg',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
} as const

interface Props {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  /** Pinned below the scrolling body — put the save/cancel buttons here. */
  footer?: ReactNode
  /** Replaces the default × close button in the header. */
  headerAction?: ReactNode
  width?: keyof typeof WIDTHS
}

export default function Modal({ title, onClose, children, footer, headerAction, width = 'lg' }: Props) {
  // Esc closes; lock page scroll behind the modal while it's mounted
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 cursor-default"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex w-full ${WIDTHS[width]} max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-surface shadow-2xl`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="min-w-0 text-base font-semibold text-fg">{title}</h2>
          {headerAction ?? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-fg-muted hover:bg-surface-raised hover:text-fg transition-colors"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Body — the only part that scrolls */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>

        {/* Footer — padded clear of the iPhone home indicator */}
        {footer && (
          <div className="shrink-0 border-t border-border px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
