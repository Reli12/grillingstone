import type { ReactNode } from 'react'

interface ExampleFrameProps {
  children: ReactNode
  caption: string
}

/** A dashed frame around a live sample of UI, with a caption. */
export function ExampleFrame({ children, caption }: ExampleFrameProps) {
  return (
    <figure className="my-5 rounded-lg border border-dashed border-line bg-fog/50 p-4">
      {children}
      <figcaption className="mt-3 text-[13px] text-ink-faint">{caption}</figcaption>
    </figure>
  )
}
