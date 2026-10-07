import { forwardRef, type TextareaHTMLAttributes, useImperativeHandle, useLayoutEffect, useRef } from 'react'

import { fieldClass } from '@/components/atoms/textInput/textInput'
import { cn } from '@/lib/cn'

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
    const el = inner.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }

  useLayoutEffect(fit, [value])

  return (
    <textarea
      ref={inner}
      rows={minRows}
      value={value}
      onInput={(e) => {
        fit()
        onInput?.(e)
      }}
      className={cn(fieldClass, 'resize-none py-2 text-sm leading-relaxed', className)}
      {...rest}
    />
  )
})
