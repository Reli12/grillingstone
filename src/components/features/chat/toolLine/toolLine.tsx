// A line in the chat showing a tool Claude used, with an icon for the tool and its outcome.
import { createElement } from 'react'

import { BookOpenText, FileText, Globe, Search, Send, ShieldAlert, Wrench } from 'lucide-react'

import { cn } from '@/lib/cn'
import type { ToolMessage } from '@/types/chat'

/** The code tools a session reads Code Folders with (ADR-0016); their only refusal is an Excluded File. */
const isCodeTool = (message: ToolMessage) => message.tool.startsWith('mcp__code__')

function toolIcon(message: ToolMessage) {
  if (message.outcome === 'denied') return ShieldAlert
  if (message.summary.includes('Glossary')) return BookOpenText
  switch (message.tool) {
    case 'Read':
    case 'mcp__code__read_code_file':
      return FileText
    case 'Grep':
    case 'Glob':
    case 'mcp__code__search_code':
    case 'mcp__code__list_code_files':
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
      {message.outcome === 'denied' && (
        <span className="shrink-0">
          {isCodeTool(message) ? '(Excluded File — not read)' : '(blocked by the session allowlist)'}
        </span>
      )}
      {message.outcome === 'error' && message.tool === 'Bash' && <span className="shrink-0">(refused)</span>}
    </p>
  )
}
