// Asks before an ended Prototype Grilling Session of no Draft is deleted, and says what goes with it.
import { Button } from '@/components/atoms/button/button'
import { Dialog } from '@/components/composite/dialog/dialog'

interface DeleteGrillingSessionDialogProps {
  open: boolean
  onClose: () => void
  onDelete: () => void
  pending: boolean
}

export function DeleteGrillingSessionDialog({
  open,
  onClose,
  onDelete,
  pending,
}: Readonly<DeleteGrillingSessionDialogProps>) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete this session?"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onDelete}>
            Delete session
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">
        The session’s conversation and every Prototype it wrote are deleted. Prototypes started from them stay as they
        are.
      </p>
    </Dialog>
  )
}
