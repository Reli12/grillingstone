// A line in the chat showing a tool the Assistant used, with an icon for the tool and its outcome.
import { createElement } from 'react'

import { BookOpenText, FileText, Globe, Search, Send, ShieldAlert, Wrench } from 'lucide-react'

import { cn } from '@/lib/cn'
import type { ToolMessage } from '@/types/chat'

function toolIcon(message: ToolMessage) {
  if (message.outcome === 'denied') return ShieldAlert
  if (message.summary.includes('Glossary')) return BookOpenText
  switch (message.tool) {
    case 'Read':
      return FileText
    case 'Grep':
    case 'Glob':
      return Search
    case 'WebSearch':
    case 'WebFetch':
      return Globe
    case 'Bash':
      return Send
    default:
      return Wrench
  }
}

export function ToolLine({ message }: Readonly<{ message: ToolMessage }>) {
  const icon = createElement(toolIcon(message), { size: 14, className: 'shrink-0' })
  const failed = message.outcome === 'denied' || message.outcome === 'error'
  return (
    <p className={cn('flex items-center gap-2 pl-3 text-[13px]', failed ? 'text-redpencil' : 'text-ink-faint')}>
      {icon}
      <span className="truncate">{message.summary}</span>
      {message.outcome === 'denied' && <span className="shrink-0">(blocked by the session allowlist)</span>}
      {message.outcome === 'error' && message.tool === 'Bash' && <span className="shrink-0">(refused)</span>}
    </p>
  )
}
