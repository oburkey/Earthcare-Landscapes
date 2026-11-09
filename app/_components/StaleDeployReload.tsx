'use client'

import { useEffect } from 'react'
import { reloadOnceIfStaleDeploy } from '@/lib/staleDeploy'

// Catches stale-deployment errors that never reach an error boundary — e.g.
// a server action awaited in a .then() or a setTimeout auto-save — and
// reloads the page once. Errors that do reach a boundary are handled in
// app/error.tsx and app/global-error.tsx.
export default function StaleDeployReload() {
  useEffect(() => {
    function onRejection(e: PromiseRejectionEvent) { reloadOnceIfStaleDeploy(e.reason) }
    function onError(e: ErrorEvent) { reloadOnceIfStaleDeploy(e.error ?? e.message) }
    window.addEventListener('unhandledrejection', onRejection)
    window.addEventListener('error', onError)
    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('error', onError)
    }
  }, [])
  return null
}
