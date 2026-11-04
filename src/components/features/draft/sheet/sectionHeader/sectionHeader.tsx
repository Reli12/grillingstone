// The Section's heading line: name, lock, the Tracker field it is copied into, and its actions.
import { Lock } from 'lucide-react'
import { toast } from 'sonner'

import type { Draft } from '#core/draft/draftTypes.ts'
import { renderSection } from '#core/publish/publishRenderer.ts'
import { type Tracker, TRACKER_LABELS } from '#core/shared/tracker.ts'
import { fieldLabel } from '#core/shared/trackerFields.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

import { Tag } from '@/components/atoms/tag/tag'
import { DiscardedToggle } from '@/components/features/draft/sheet/discardedToggle/discardedToggle'
import { RowActions } from '@/components/features/draft/sheet/rowActions/rowActions'
import { useDiscardedVisibility } from '@/context/DiscardedVisibility/DiscardedVisibility'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
import { copyRich } from '@/lib/clipboard'
import type { SectionProps } from '@/types/draft'

/**
 * Copies one Section exactly as the Publish Renderer writes it into its field. For Jira the plain-text
 * flavour is wiki markup, so the same copy pastes as rich text in Cloud or Visual mode and as wiki markup
 * into Data Center's Text mode.
 */
async function copySection(draft: Draft, sectionId: string) {
  const html = renderSection(draft, sectionId)
  if (html === null) return
  const wiki = templateTracker(draft.template) === 'jira' ? renderSection(draft, sectionId, 'jira-wiki') : null
  await copyRich(html, wiki ?? undefined)
}

/** The Copy button's tooltip: which field the Section goes into, and for Jira, the two paste modes. */
function copyTitle(tracker: Tracker, target: string) {
  const base = `Copy this Section for the ${fieldLabel(target)} field`
  return tracker === 'jira' ? `${base} — rich text, or wiki markup in Text mode` : base
}

/** Shows or hides this Section's Discarded Entries; renders nothing when it has none. */
function SectionDiscardedToggle({ section }: Readonly<SectionProps>) {
  const { showsInSection, setShowsInSection } = useDiscardedVisibility()
  return (
    <DiscardedToggle
      shown={showsInSection(section.id)}
      count={section.entries.filter((entry) => entry.discarded).length}
      onChange={(show) => setShowsInSection(section.id, show)}
      scope="in this Section"
    />
  )
}

/** The Section's heading line: name, lock, the Tracker field it is copied into, and its actions. */
export function SectionHeader({ section }: Readonly<SectionProps>) {
  const { draft, apply, grill, sessionRunning } = useDraftEditor()
  const tracker = templateTracker(draft.template)
  // A locked Section can never be discarded, so it offers no Discard action.
  const discard = section.locked ? undefined : () => apply({ op: 'discardSection', sectionId: section.id })
  const copy = () =>
    copySection(draft, section.id).then(
      () => toast.success(`Copied “${section.heading}” for ${TRACKER_LABELS[tracker]}.`),
      () => toast.error('The browser refused clipboard access.'),
    )
  return (
    <header className="group/head flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
      <h2 className="font-serif text-[19px] font-semibold tracking-tight text-ink">{section.heading}</h2>
      {section.locked && (
        <span className="text-ink-faint" title="Locked Section — you can edit and move it, never discard it">
          <Lock size={14} aria-label="Locked" />
        </span>
      )}
      <Tag tone="claude" title="The field this Section is copied into">
        {fieldLabel(section.target)}
      </Tag>
      <span className="ml-auto" />
      <SectionDiscardedToggle section={section} />
      <RowActions
        grillDisabled={sessionRunning}
        onGrill={() => grill({ sectionId: section.id, heading: section.heading })}
        onCopy={() => void copy()}
        copyTitle={copyTitle(tracker, section.target)}
        onDiscard={discard}
      />
    </header>
  )
}
