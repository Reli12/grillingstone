// Hands the textarea both to React Hook Form and to the caller's forwarded ref.
import { type ForwardedRef } from 'react'

/** Hands the textarea both to React Hook Form and to the caller's forwarded ref. */
export function bothRefs(
  fieldRef: (element: HTMLTextAreaElement | null) => void,
  ref: ForwardedRef<HTMLTextAreaElement>,
) {
  return (element: HTMLTextAreaElement | null) => {
    fieldRef(element)
    if (typeof ref === 'function') ref(element)
    else if (ref) ref.current = element
  }
}
