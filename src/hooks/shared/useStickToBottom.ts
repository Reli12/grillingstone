// Stay pinned to the newest message while the reader is within this distance of the bottom.
import { useEffect, useLayoutEffect, useRef } from 'react'

/** Stay pinned to the newest message while the reader is within this distance of the bottom. */
const STICK_TO_BOTTOM_PX = 80

/**
 * Keeps the returned scroller pinned to the bottom as messages arrive, unless the reader has
 * scrolled up to read something earlier.
 */
export function useStickToBottom(messageCount: number, liveStatus?: string) {
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  useLayoutEffect(() => {
    const element = scroller.current
    if (element && stick.current) element.scrollTop = element.scrollHeight
  }, [messageCount, liveStatus])
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const onScroll = () => {
      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
      stick.current = distanceFromBottom < STICK_TO_BOTTOM_PX
    }
    element.addEventListener('scroll', onScroll)
    return () => element.removeEventListener('scroll', onScroll)
  }, [])
  return scroller
}
