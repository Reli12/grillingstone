// Fetching a Backlog Copy through the Connection: the human gives the work item's ID or link and the tool reads and
// saves its content, instead of the human pasting it. An item that is already a Copy is Refreshed. Pasting by hand
// stays one click away.
import { useId, useState } from 'react'

import { toast } from 'sonner'

import { useFetchCopy } from '@/api/hooks/ado/adoHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { Dialog } from '@/components/composite/dialog/dialog'

interface FetchCopyDialogProps {
  projectId: string
  onClose: () => void
  /** Switches to pasting the Copy by hand. */
  onPasteInstead: () => void
}

/** Mounted only while open, so every opening starts empty. */
export function FetchCopyDialog({ projectId, onClose, onPasteInstead }: Readonly<FetchCopyDialogProps>) {
  const ids = useId()
  const [workItem, setWorkItem] = useState('')
  const fetchCopy = useFetchCopy(projectId)
  const ready = !!workItem.trim() && !fetchCopy.isPending

  const submit = (event?: { preventDefault: () => void }) => {
    event?.preventDefault()
    if (!ready) return
    fetchCopy.mutate(workItem.trim(), {
      onSuccess: ({ copy, created, changed }) => {
        const name = `#${copy.workItemId} ${copy.title}`
        if (created) toast.success(`${name} saved as a Backlog Copy.`)
        else
          toast.success(
            changed ? `${name} was already a Copy — refreshed, its Drafts are flagged.` : `${name} is up to date.`,
          )
        onClose()
      },
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Fetch a Backlog Copy from Azure DevOps"
      footer={
        <>
          <Button variant="quiet" onClick={onPasteInstead}>
            Paste by hand instead
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="claude" disabled={!ready} onClick={() => submit()}>
            {fetchCopy.isPending ? 'Fetching…' : 'Fetch and save'}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={submit}>
        <p className="text-sm text-ink-soft">
          The title, type, description and Acceptance Criteria are read from the work item and saved locally. It does
          not follow later changes on its own — Refresh it when the item changes.
        </p>
        <div>
          <FieldLabel htmlFor={`${ids}-item`}>Work item ID or link</FieldLabel>
          <TextInput
            id={`${ids}-item`}
            autoFocus
            value={workItem}
            onChange={(event) => setWorkItem(event.target.value)}
            placeholder="1234, #1234 or https://dev.azure.com/…/_workitems/edit/1234"
          />
        </div>
        <FieldError message={fetchCopy.error?.message} />
      </form>
    </Dialog>
  )
}
