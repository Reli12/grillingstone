// Closes the open menu on a mouse press anywhere outside it.
import { useEffect, useRef } from 'react'

/** Closes the open menu on a mouse press anywhere outside it. */
export function useCloseOnOutsidePress(open: boolean, setOpen: (open: boolean) => void) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPress = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPress)
    return () => document.removeEventListener('mousedown', onPress)
  }, [open, setOpen])
  return container
}
