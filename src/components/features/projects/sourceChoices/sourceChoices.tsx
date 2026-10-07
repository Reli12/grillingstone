// New Project: the options for how the Glossary starts (empty, from text, copy of another Project's).
import { ClipboardPaste, Copy, FilePlus2 } from 'lucide-react'

import { SourceChoice } from '@/components/features/projects/sourceChoice/sourceChoice'
import type { Source } from '@/types/project'

interface SourceChoicesProps {
  current: Source
  /** Copying needs another Project to copy from. */
  offerCopy: boolean
  onPick: (source: Source) => void
}

export function SourceChoices({ current, offerCopy, onPick }: Readonly<SourceChoicesProps>) {
  const shared = { current, onPick }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Glossary starts…</p>
      <SourceChoice
        {...shared}
        value="empty"
        icon={<FilePlus2 size={14} />}
        label="Empty"
        hint="Claude adds terms as you grill."
      />
      <SourceChoice
        {...shared}
        value="paste"
        icon={<ClipboardPaste size={14} />}
        label="From text I have"
        hint="Paste or upload any glossary."
      />
      {offerCopy && (
        <SourceChoice
          {...shared}
          value="copy"
          icon={<Copy size={14} />}
          label="As a copy of a Project"
          hint="Copied once, then independent."
        />
      )}
    </div>
  )
}
