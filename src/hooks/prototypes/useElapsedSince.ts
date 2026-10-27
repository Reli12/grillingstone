// How many milliseconds have passed since a moment, re-read every second while the component is mounted.
import { useEffect, useState } from 'react'

const TICK_MS = 1000

/** Milliseconds since `iso`, ticking once a second. */
export function useElapsedSince(iso: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])
  return now - new Date(iso).getTime()
}
