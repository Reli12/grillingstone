// Asks before a Prototype is deleted, and says what goes and what stays.
import { Button } from '@/components/atoms/button/button'
import { Dialog } from '@/components/composite/dialog/dialog'

interface DeletePrototypeDialogProps {
  open: boolean
  onClose: () => void
  onDelete: () => void
}

export function DeletePrototypeDialog({ open, onClose, onDelete }: Readonly<DeletePrototypeDialogProps>) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete this Prototype?"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete Prototype
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">
        The Prototype is removed from the Draft and the Project. Prototypes started from it stay as they are, and so
        does the Draft.
      </p>
    </Dialog>
  )
}
