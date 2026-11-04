// Asks before a Backlog Copy is deleted, listing the Drafts that lose their Backlog Reference to it.
import type { BacklogCopySummary } from '#core/contract/apiTypes.ts'

import { useDeleteBacklogCopy } from '@/api/hooks/backlogCopies/backlogCopyHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { Dialog } from '@/components/composite/dialog/dialog'

interface DeleteCopyDialogProps {
  projectId: string
  summary: BacklogCopySummary
  onClose: () => void
}

/** Mounted only while open; key it by the Copy so a refusal never carries over to another. */
export function DeleteCopyDialog({ projectId, summary, onClose }: Readonly<DeleteCopyDialogProps>) {
  const remove = useDeleteBacklogCopy(projectId)
  const { copy, drafts } = summary
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Delete Backlog Copy #${copy.workItemId}?`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(copy.id, { onSuccess: onClose })}
          >
            Delete Backlog Copy
          </Button>
        </>
      }
    >
      {drafts.length ? (
        <>
          <p className="mb-2 text-sm text-ink-soft">
            These Drafts lose their Backlog Reference to “{copy.title}”. Their later sessions no longer see it:
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {drafts.map((draft) => (
              <li key={draft.id}>{draft.title || draft.requirement || 'Untitled Draft'}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-ink-soft">No Draft references “{copy.title}”.</p>
      )}
      <p className="mt-3 text-sm text-ink-soft">The work item in Azure DevOps is not touched.</p>
      <FieldError message={remove.error?.message} />
    </Dialog>
  )
}
