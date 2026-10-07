// On small screens the Draft and the chat take turns; these tabs switch between them.
import { cn } from '@/lib/cn'
import type { MobileView } from '@/types/draftPage'

interface MobileTabsProps {
  view: MobileView
  running: boolean
  onChange: (view: MobileView) => void
}

/** On small screens the Draft and the chat take turns; these tabs switch between them. */
export function MobileTabs({ view, running, onChange }: Readonly<MobileTabsProps>) {
  const chatLabel = running ? 'Chat (running)' : 'Chat'
  return (
    <div className="flex shrink-0 border-b border-line bg-sheet p-1 lg:hidden" role="tablist">
      {(['draft', 'chat'] as const).map((option) => (
        <button
          key={option}
          role="tab"
          aria-selected={view === option}
          onClick={() => onChange(option)}
          className={cn(
            'h-8 flex-1 rounded-md text-sm font-medium',
            view === option ? 'bg-fog-deep text-ink' : 'text-ink-soft',
          )}
        >
          {option === 'draft' ? 'Draft' : chatLabel}
        </button>
      ))}
    </div>
  )
}
