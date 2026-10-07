import { Link } from 'react-router'

import type { DraftSummary } from '#core/contract/apiTypes.ts'

import { Tag } from '@/components/atoms/tag/tag'
import { routesPaths } from '@/routes/routes'

const when = (iso: string) => {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days < 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return d.toLocaleDateString()
}

interface DraftListProps {
  drafts: DraftSummary[]
}

export function DraftList({ drafts }: DraftListProps) {
  return (
    <ul className="divide-y divide-line-soft rounded-lg border border-line bg-sheet">
      {drafts.map((d) => (
        <li key={d.id}>
          <Link
            to={routesPaths.draft(d.projectId, d.id)}
            className="grid grid-cols-[64px_1fr_auto] items-baseline gap-3 px-4 py-3.5 hover:bg-fog/60"
          >
            <Tag
              tone={d.workItemType === 'PBI' ? 'claude' : d.workItemType === 'Feature' ? 'proof' : 'ink'}
              className="justify-center"
            >
              {d.workItemType}
            </Tag>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {d.title || <span className="text-ink-soft italic">{d.requirement}</span>}
              </span>
              <span className="mt-0.5 block text-[13px] text-ink-faint">
                {d.version === 0 ? 'Grilling — no Draft yet' : `v${d.version}`}, {d.templateName}
                {d.pendingChanges > 0 && (
                  <span className="ml-2 font-medium text-redpencil">
                    {d.pendingChanges} change{d.pendingChanges === 1 ? '' : 's'} to triage
                  </span>
                )}
              </span>
            </span>
            <span className="text-[13px] text-ink-faint">{when(d.updatedAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
