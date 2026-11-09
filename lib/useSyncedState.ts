import { useState, type Dispatch, type SetStateAction } from 'react'

// Local state that follows the server: when a refresh brings a new value for
// the prop, local state is replaced with it. Optimistic changes still work in
// between. (Plain useState only reads its initial value once, so flags shown
// on screen went stale after a save elsewhere changed them.)
export function useSyncedState<T>(serverValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(serverValue)
  const [prevServerValue, setPrevServerValue] = useState(serverValue)
  if (!Object.is(prevServerValue, serverValue)) {
    setPrevServerValue(serverValue)
    setValue(serverValue)
  }
  return [value, setValue]
}

// Same for a map of id -> flag. Only ids whose server value changed are
// replaced, so an optimistic toggle still in flight on another id is kept.
export function useSyncedFlagMap(
  entries: [string, boolean][]
): [Record<string, boolean>, Dispatch<SetStateAction<Record<string, boolean>>>] {
  const serverKey = JSON.stringify(entries)
  const [map, setMap] = useState<Record<string, boolean>>(() => Object.fromEntries(entries))
  const [prevServerKey, setPrevServerKey] = useState(serverKey)
  if (prevServerKey !== serverKey) {
    const prev = Object.fromEntries(JSON.parse(prevServerKey) as [string, boolean][])
    const changed = entries.filter(([id, v]) => prev[id] !== v)
    setPrevServerKey(serverKey)
    if (changed.length > 0) setMap((m) => ({ ...m, ...Object.fromEntries(changed) }))
  }
  return [map, setMap]
}
