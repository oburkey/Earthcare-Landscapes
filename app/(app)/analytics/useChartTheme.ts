'use client'

import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributeFilter: ['class'] })
  return () => obs.disconnect()
}

export function useChartTheme() {
  const isDark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )

  return {
    grid:    isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    ticks:   isDark ? '#a8a29e' : '#78716c',
    legend:  isDark ? '#d6d3d1' : '#44403c',
    tooltip: {
      backgroundColor: isDark ? '#252525' : 'rgba(17,17,17,0.88)',
      titleColor:      isDark ? '#f5f5f4'  : '#ffffff',
      bodyColor:       isDark ? '#d6d3d1'  : '#e7e5e4',
    },
  }
}
