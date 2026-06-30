'use client'

import { useSyncExternalStore } from 'react'

// useSyncExternalStore is the React 18+ idiom for subscribing to external DOM state.
// It handles SSR (getServerSnapshot), hydration, and re-rendering on change without
// any setState-in-effect pattern that would trigger lint errors.

function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, { attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function getThemeServerSnapshot() {
  return 'light' as const
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getThemeServerSnapshot)

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try { localStorage.setItem('theme', next) } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center w-7 h-7 shrink-0 rounded-md text-fg-muted hover:text-fg-secondary hover:bg-surface-raised transition-colors"
    >
      {theme === 'dark' ? (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      )}
    </button>
  )
}
