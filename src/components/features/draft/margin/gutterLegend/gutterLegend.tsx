// The key to the ownership gutter's marks, shown under the Draft.
import { ArrowUpDown } from 'lucide-react'

import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'

/** Explains the ownership gutter's marks. */
export function GutterLegend() {
  const assistant = useAssistantLabel()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-faint">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-[2px] rounded-full bg-claude/45" /> Written by {assistant}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-[5px] rounded-full bg-mark" /> Edited by you
      </span>
      <span className="flex items-center gap-1.5">
        <ArrowUpDown size={12} /> Moved by you
      </span>
      <span>Changes to your marks come back as Conflicts.</span>
    </div>
  )
}
