// Whether an Assistant can run a session now: "Ready", or the backend's fix with its commands set as code.
import type { Availability } from '#core/contract/apiTypes.ts'

import { InlineCode } from '@/components/atoms/inlineCode/inlineCode'
import { Tag } from '@/components/atoms/tag/tag'

/** The fix text marks commands with backticks; every odd part of a split on them is a command. */
const BACKTICK = '`'

export function AvailabilityNote({ availability }: Readonly<{ availability: Availability }>) {
  if (availability.ready) return <Tag tone="proof">Ready</Tag>
  const parts = availability.fix.split(BACKTICK)
  return (
    <span className="block text-[13px] text-redpencil">
      {parts.map((part, i) => (i % 2 === 1 ? <InlineCode key={i}>{part}</InlineCode> : part))}
    </span>
  )
}
