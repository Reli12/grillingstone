// Asks before a Project stops using its Backlog: Publish and Import turn off, nothing changes in Azure DevOps.
import { useClearBacklog } from '@/api/hooks/ado/adoHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { Dialog } from '@/components/composite/dialog/dialog'

interface RemoveBacklogDialogProps {
  projectId: string
  backlog: string
  onClose: () => void
}

/** Mounted only while open, so a refusal never carries over. */
export function RemoveBacklogDialog({ projectId, backlog, onClose }: Readonly<RemoveBacklogDialogProps>) {
  const clear = useClearBacklog(projectId)
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Remove the Backlog “${backlog}”?`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            disabled={clear.isPending}
            onClick={() => clear.mutate(undefined, { onSuccess: onClose })}
          >
            Remove Backlog
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">
        Publish and Import turn off for this Project until you choose a Backlog again. Nothing changes in Azure DevOps,
        and Backlog Copies, Fetch and Refresh keep working.
      </p>
      <FieldError message={clear.error?.message} />
    </Dialog>
  )
}
