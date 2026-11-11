// Above the sheet: where this Draft sits, show/hide Discarded parts, and References, Delete and Copy for the
// Draft's Tracker — and for Azure DevOps, its Linked Work Item and Publish.
import { Link } from 'react-router'

import { ClipboardCopy, Link2, Trash2 } from 'lucide-react'

import type { Draft } from '#core/draft/draftTypes.ts'
import { TRACKER_LABELS } from '#core/shared/tracker.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { AzureActions } from '@/components/features/draft/publish/azureActions/azureActions'
import { DiscardedToggle } from '@/components/features/draft/sheet/discardedToggle/discardedToggle'
import { useDiscardedVisibility } from '@/context/DiscardedVisibility/DiscardedVisibility'
import { routesPaths } from '@/routes/routes'

/** Discarded Sections, plus Discarded Entries in the Sections that are still there. */
function discardedCount(draft: Draft) {
  return draft.sections.reduce(
    (count, section) => count + (section.discarded ? 1 : section.entries.filter((entry) => entry.discarded).length),
    0,
  )
}

interface DraftToolbarProps {
  projectId: string
  projectName?: string
  draft: Draft
  running: boolean
  onReferences: () => void
  onDelete: () => void
  onCopy: () => void
  onPublish: () => void
}

/** Above the sheet: where this Draft sits, and References, Delete and Copy for the Draft's Tracker. */
export function DraftToolbar({
  projectId,
  projectName,
  draft,
  running,
  onReferences,
  onDelete,
  onCopy,
  onPublish,
}: Readonly<DraftToolbarProps>) {
  const referenceCount = draft.references.length
  const { showAll, setShowAll } = useDiscardedVisibility()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <p className="text-[13px] text-ink-faint">
        <Link to={routesPaths.project(projectId)} className="hover:text-ink">
          {projectName}
        </Link>
        , {draft.workItemType} in the {draft.template.name} v{draft.template.version},{' '}
        <span className="font-medium text-ink">Draft v{draft.version}</span>
      </p>
      <span className="ml-auto" />
      <DiscardedToggle shown={showAll} count={discardedCount(draft)} onChange={setShowAll} scope="in this Draft" />
      <Button size="sm" variant="quiet" onClick={onReferences}>
        <Link2 size={14} /> References{referenceCount ? ` (${referenceCount})` : ''}
      </Button>
      <Button size="sm" variant="quiet" onClick={onDelete} disabled={running} aria-label="Delete Draft">
        <Trash2 size={14} />
      </Button>
      {templateTracker(draft.template) === 'azure-devops' && (
        <AzureActions projectId={projectId} draft={draft} onPublish={onPublish} />
      )}
      <Button size="sm" variant="ink" onClick={onCopy}>
        <ClipboardCopy size={14} /> Copy for {TRACKER_LABELS[templateTracker(draft.template)]}
      </Button>
    </div>
  )
}
