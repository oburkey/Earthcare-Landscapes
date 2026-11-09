// A tab left open across a deployment (common on iPads) keeps running the old
// JavaScript. Its server action calls then fail, or its code chunks no longer
// exist. Reloading the page once picks up the new code.
//
// - Server action missing on the new deployment: the server logs "Failed to
//   find Server Action" and returns a 404, which the client surfaces as "An
//   unexpected response was received from the server."
// - Code chunk missing: ChunkLoadError / "Loading chunk … failed".
//
// Note the 404 message is generic, so another failed server response can also
// trigger the reload. It happens at most once a minute per tab.

const STALE_DEPLOY_PATTERNS = [
  /Failed to find Server Action/i,
  /unexpected response was received from the server/i,
  /ChunkLoadError/i,
  /Loading (CSS )?chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
]

const RELOAD_KEY = 'stale-deploy-reload-at'
const RELOAD_COOLDOWN_MS = 60_000

function errorText(err: unknown): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; message?: unknown }
    return `${typeof e.name === 'string' ? e.name : ''} ${typeof e.message === 'string' ? e.message : ''}`
  }
  return ''
}

export function isStaleDeployError(err: unknown): boolean {
  const text = errorText(err)
  return text !== '' && STALE_DEPLOY_PATTERNS.some((p) => p.test(text))
}

// Returns true if a reload was started.
export function reloadOnceIfStaleDeploy(err: unknown): boolean {
  if (typeof window === 'undefined' || !isStaleDeployError(err)) return false
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Without storage we can't guard against a reload loop, so don't reload
    return false
  }
  window.location.reload()
  return true
}
