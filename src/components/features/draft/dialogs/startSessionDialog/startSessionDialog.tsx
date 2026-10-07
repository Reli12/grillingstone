import { useState } from 'react'

import { Button } from '@/components/atoms/button/button'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { Dialog } from '@/components/composite/dialog/dialog'

/** Sessions started from a dialog; plain New Iterations start by typing in the chat. */
export type StartIntent =
  { kind: 'focused'; sectionId: string; entryId?: string; heading: string } | { kind: 'upgrade' }

interface StartSessionDialogProps {
  intent: StartIntent | null
  onClose: () => void
  onStart: (note: string) => void
  pending: boolean
}

/** Confirms a Focused Session or Template upgrade, with an optional note for Claude. */
export function StartSessionDialog({ intent, onClose, onStart, pending }: StartSessionDialogProps) {
  const [note, setNote] = useState('')
  const title = intent?.kind === 'focused' ? `Grill “${intent.heading}”` : 'Upgrade to the latest Template'
  return (
    <Dialog
      open={intent !== null}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="claude" disabled={pending} onClick={() => onStart(note)}>
            Start grilling
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-soft">
        {intent?.kind === 'focused'
          ? 'Claude grills only this part, starting from the current Draft and Glossary. It returns a Proposal and may suggest knock-on changes elsewhere — nothing changes until you accept.'
          : 'Claude proposes the Sections the newer Template adds and any rewrites its method requires. You triage it like any Proposal.'}
      </p>
      {intent && (
        <TextArea
          autoFocus
          minRows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What changed, or what should Claude look at? (optional)"
          aria-label="Note for Claude"
        />
      )}
    </Dialog>
  )
}
