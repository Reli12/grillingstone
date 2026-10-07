// Enter sends; Shift+Enter keeps a new line; Enter that confirms an IME composition does neither.
import { type KeyboardEvent } from 'react'

/** Enter sends; Shift+Enter keeps a new line; Enter that confirms an IME composition does neither. */
export function sendOnEnter(send: () => Promise<void>) {
  return (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }
}
