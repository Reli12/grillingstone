// The left column from v1 on: the sessions or the Glossary.
import { type ReactNode } from 'react'

import { SideTab } from '@/components/atoms/sideTab/sideTab'
import { WideToggle } from '@/components/features/draft/layout/wideToggle/wideToggle'
import { GlossaryPreview } from '@/components/features/glossary/glossaryPreview/glossaryPreview'
import { cn } from '@/lib/cn'
import type { Side } from '@/types/draftPage'

interface SidePanelProps {
  projectId: string
  side: Side
  visible: boolean
  running: boolean
  /** Whether the panel is widened beside the Draft (desktop only). */
  wide: boolean
  chat: ReactNode
  onSideChange: (side: Side) => void
  onWideChange: (wide: boolean) => void
}

/** The left column from v1 on: the sessions or the Glossary. */
export function SidePanel({
  projectId,
  side,
  visible,
  running,
  wide,
  chat,
  onSideChange,
  onWideChange,
}: Readonly<SidePanelProps>) {
  return (
    <aside className={cn('min-h-0 flex-1 flex-col border-r border-line lg:flex', visible ? 'flex' : 'hidden')}>
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-2">
        <div className="flex items-center gap-1" role="tablist">
          <SideTab selected={side === 'chat'} onSelect={() => onSideChange('chat')}>
            Sessions
          </SideTab>
          <SideTab selected={side === 'glossary'} onSelect={() => onSideChange('glossary')}>
            Glossary
          </SideTab>
        </div>
        {running && (
          <span className="ml-auto flex items-center gap-1.5 pr-1 text-[13px] text-claude">
            <span className="size-2 animate-pulse rounded-full bg-claude" /> Session running
          </span>
        )}
        <WideToggle wide={wide} onWideChange={onWideChange} className={cn(!running && 'ml-auto')} />
      </div>
      {side === 'chat' ? (
        chat
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <GlossaryPreview projectId={projectId} />
        </div>
      )}
    </aside>
  )
}
