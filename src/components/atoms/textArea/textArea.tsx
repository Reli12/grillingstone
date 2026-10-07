// A multi-line text field that grows to fit its content instead of scrolling.
import { forwardRef, type TextareaHTMLAttributes, useImperativeHandle, useLayoutEffect, useRef } from 'react'

import { fieldClass } from '@/components/atoms/textInput/textInput'
import { cn } from '@/lib/cn'

/** Room for the top and bottom border, which scrollHeight leaves out; without it a scrollbar flickers. */
const BORDER_ALLOWANCE_PX = 2

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number
}

/** A textarea that grows with its content — controlled (`value`) or registered with React Hook Form. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, value, minRows = 3, onInput, ...rest },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => inner.current!, [])

  const fit = () => {
    const textarea = inner.current
    if (!textarea) return
    // Collapse first so the measured height can also shrink when text is deleted.
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight + BORDER_ALLOWANCE_PX}px`
  }

  useLayoutEffect(fit, [value])

  return (
    <textarea
      ref={inner}
      rows={minRows}
      value={value}
      onInput={(event) => {
        fit()
        onInput?.(event)
      }}
      className={cn(fieldClass, 'resize-none py-2 text-sm leading-relaxed', className)}
      {...rest}
    />
  )
})
