// Renders Markdown written by Claude or a human as styled HTML.
import { useMemo } from 'react'

import { markdownToHtml } from '#core/shared/markdownHtml.ts'

import { cn } from '@/lib/cn'

interface RichTextProps {
  text: string
  className?: string
}

/**
 * Renders the small markdown subset Claude and humans write (paragraphs, lists, tables, bold, code, links).
 * markdownToHtml escapes everything first, so the HTML is safe to inject.
 */
export function RichText({ text, className }: Readonly<RichTextProps>) {
  const html = useMemo(() => markdownToHtml(text), [text])
  return (
    <div
      className={cn(
        '[&_a]:text-claude [&_a]:underline [&_code]:rounded [&_code]:bg-fog [&_code]:px-1 [&_code]:text-[0.92em] [&_li]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-2 [&_table]:my-1 [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:bg-fog [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul+p]:mt-2 [&_p+ul]:mt-1',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
