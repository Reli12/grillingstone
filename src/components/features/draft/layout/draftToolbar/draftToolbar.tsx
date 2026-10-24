// Above the sheet: where this Draft sits, and References, Delete and Copy for the Draft's Tracker.
import { Link } from 'react-router'

import { ClipboardCopy, Link2, Trash2 } from 'lucide-react'

import type { Draft } from '#core/draft/draftTypes.ts'
import { TRACKER_LABELS } from '#core/shared/tracker.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { routesPaths } from '@/routes/routes'

interface DraftToolbarProps {
  projectId: string
  projectName?: string
  draft: Draft
  running: boolean
  onReferences: () => void
  onDelete: () => void
  onCopy: () => void
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
}: Readonly<DraftToolbarProps>) {
  const referenceCount = draft.references.length
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
      <Button size="sm" variant="quiet" onClick={onReferences}>
        <Link2 size={14} /> References{referenceCount ? ` (${referenceCount})` : ''}
      </Button>
      <Button size="sm" variant="quiet" onClick={onDelete} disabled={running} aria-label="Delete Draft">
        <Trash2 size={14} />
      </Button>
      <Button size="sm" variant="ink" onClick={onCopy}>
        <ClipboardCopy size={14} /> Copy for {TRACKER_LABELS[templateTracker(draft.template)]}
      </Button>
    </div>
  )
}
