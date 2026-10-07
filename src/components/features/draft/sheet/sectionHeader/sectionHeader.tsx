// The Section's heading line: name, lock, the ADO field it publishes to, and its actions.
import { Lock } from 'lucide-react'

import { ADO_FIELD_LABELS } from '#core/shared/adoFields.ts'

import { Tag } from '@/components/atoms/tag/tag'
import { RowActions } from '@/components/features/draft/sheet/rowActions/rowActions'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
import type { SectionProps } from '@/types/draft'

/** The Section's heading line: name, lock, the ADO field it publishes to, and its actions. */
export function SectionHeader({ section }: Readonly<SectionProps>) {
  const { apply, grill, sessionRunning } = useDraftEditor()
  // A locked Section can never be discarded, so it offers no Discard action.
  const discard = section.locked ? undefined : () => apply({ op: 'discardSection', sectionId: section.id })
  return (
    <header className="group/head flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
      <h2 className="font-serif text-[19px] font-semibold tracking-tight text-ink">{section.heading}</h2>
      {section.locked && (
        <span className="text-ink-faint" title="Locked Section — you can edit and move it, never discard it">
          <Lock size={14} aria-label="Locked" />
        </span>
      )}
      <Tag tone="claude" title="The Azure DevOps field this Section is copied into">
        {ADO_FIELD_LABELS[section.target] ?? section.target}
      </Tag>
      <span className="ml-auto" />
      <RowActions
        grillDisabled={sessionRunning}
        onGrill={() => grill({ sectionId: section.id, heading: section.heading })}
        onDiscard={discard}
      />
    </header>
  )
}
