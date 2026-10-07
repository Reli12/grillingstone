// Tag colour per Work Item Type; the others are ink.
import { Link } from 'react-router'

import type { DraftSummary } from '#core/contract/apiTypes.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'

import { Tag } from '@/components/atoms/tag/tag'
import { routesPaths } from '@/routes/routes'

const DAY_MS = 86_400_000

/** Tag colour per Work Item Type; the others are ink. */
const TYPE_TONE: Partial<Record<WorkItemType, 'claude' | 'proof'>> = { PBI: 'claude', Feature: 'proof' }

/** Today: the time. This week: "n days ago". Older: the date. */
const when = (iso: string) => {
  const date = new Date(iso)
  const days = Math.floor((Date.now() - date.getTime()) / DAY_MS)
  if (days < 1) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}

export function DraftRow({ draft }: Readonly<{ draft: DraftSummary }>) {
  const versionText = draft.version === 0 ? 'Grilling — no Draft yet' : `v${draft.version}`
  return (
    <Link
      to={routesPaths.draft(draft.projectId, draft.id)}
      className="grid grid-cols-[64px_1fr_auto] items-baseline gap-3 px-4 py-3.5 hover:bg-fog/60"
    >
      <Tag tone={TYPE_TONE[draft.workItemType] ?? 'ink'} className="justify-center">
        {draft.workItemType}
      </Tag>
      <span className="min-w-0">
        <span className="block truncate font-medium">
          {/* Before the first write a Draft has no title yet; show what was asked for instead. */}
          {draft.title || <span className="text-ink-soft italic">{draft.requirement}</span>}
        </span>
        <span className="mt-0.5 block text-[13px] text-ink-faint">
          {versionText}, {draft.templateName}
          {draft.pendingChanges > 0 && (
            <span className="ml-2 font-medium text-redpencil">
              {draft.pendingChanges} change{draft.pendingChanges === 1 ? '' : 's'} to triage
            </span>
          )}
        </span>
      </span>
      <span className="text-[13px] text-ink-faint">{when(draft.updatedAt)}</span>
    </Link>
  )
}
