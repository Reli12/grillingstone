// The Draft toolbar's Azure DevOps part: the Linked Work Item (with Unlink), and Publish — disabled, with the reason,
// while the Project has no Backlog or the Connection is missing or rejected. An Archived Draft offers no Publish.
import { ExternalLink, Link2Off, Send } from 'lucide-react'

import type { Draft } from '#core/draft/draftTypes.ts'

import { useConnection, useUnlinkWorkItem } from '@/api/hooks/ado/adoHooks'
import { useProject } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'

interface AzureActionsProps {
  projectId: string
  draft: Draft
  onPublish: () => void
}

/** Why Publish cannot start, or null when they can. */
function unavailable(connection: string | undefined, backlog: string | undefined): string | null {
  if (connection === 'none') return 'Set up the Connection to Azure DevOps in Settings first.'
  if (connection === 'rejected') return 'Token rejected — replace it in Settings.'
  if (!backlog) return 'Choose this Project’s Backlog in its Settings first.'
  return null
}

export function AzureActions({ projectId, draft, onPublish }: Readonly<AzureActionsProps>) {
  const { data: connection } = useConnection()
  const { data: project } = useProject(projectId)
  const unlink = useUnlinkWorkItem(projectId, draft.id)
  const why = connection && project ? unavailable(connection.state, project.backlog) : 'Checking…'
  const linked = draft.linkedWorkItem
  return (
    <>
      {linked && (
        <span className="flex items-center gap-1 text-[13px]">
          <a
            href={linked.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-claude hover:underline"
          >
            <ExternalLink size={13} /> #{linked.id}
          </a>
          {!draft.archived && (
            <Button
              size="sm"
              variant="quiet"
              aria-label={`Unlink #${linked.id}`}
              title="Unlink — nothing changes in Azure DevOps"
              disabled={unlink.isPending}
              onClick={() => unlink.mutate()}
            >
              <Link2Off size={14} />
            </Button>
          )}
        </span>
      )}
      {!draft.archived && (
        <Button size="sm" variant="outline" disabled={why !== null} title={why ?? undefined} onClick={onPublish}>
          <Send size={14} /> Publish
        </Button>
      )}
    </>
  )
}
