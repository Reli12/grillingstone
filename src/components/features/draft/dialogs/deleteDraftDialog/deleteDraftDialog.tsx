import { Button } from '@/components/atoms/button/button'
import { Dialog } from '@/components/composite/dialog/dialog'

interface DeleteDraftDialogProps {
  open: boolean
  onClose: () => void
  onDelete: () => void
}

export function DeleteDraftDialog({ open, onClose, onDelete }: DeleteDraftDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete this Draft?"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete Draft
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">The Draft and its markdown are removed from the Project. Transcripts and the Glossary stay.</p>
    </Dialog>
  )
}
