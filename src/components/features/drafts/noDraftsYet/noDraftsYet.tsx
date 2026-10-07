// The empty state of a Project with no Drafts yet, linking to New Draft.
import { Link } from 'react-router'

import { Button } from '@/components/atoms/button/button'
import { EmptyState } from '@/components/composite/emptyState/emptyState'
import { routesPaths } from '@/routes/routes'

export function NoDraftsYet({ projectId }: Readonly<{ projectId: string }>) {
  return (
    <EmptyState
      title="No Drafts in this Project yet"
      action={
        <Link to={routesPaths.newDraft(projectId)}>
          <Button variant="claude" tabIndex={-1}>
            Grill your first requirement
          </Button>
        </Link>
      }
    >
      Describe a requirement or a bug, pick its Work Item Type, and Claude grills it with you until it can be written
      down.
    </EmptyState>
  )
}
