// Confirms starting a Focused Session or a Template upgrade, with an optional note for the Assistant.
import { useState } from 'react'

import { Button } from '@/components/atoms/button/button'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { Dialog } from '@/components/composite/dialog/dialog'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'

/** Sessions started from a dialog; plain New Iterations start by typing in the chat. */
export type StartIntent =
  { kind: 'focused'; sectionId: string; entryId?: string; heading: string } | { kind: 'upgrade' }

const focusedExplanation = (assistant: string) =>
  `${assistant} grills only this part, starting from the current Draft and Glossary. It returns a Proposal and may suggest knock-on changes elsewhere — nothing changes until you accept.`
const upgradeExplanation = (assistant: string) =>
  `${assistant} proposes the Sections the newer Template adds and any rewrites its method requires. You triage it like any Proposal.`

interface StartSessionDialogProps {
  intent: StartIntent | null
  onClose: () => void
  onStart: (note: string) => void
  pending: boolean
}

/** Confirms a Focused Session or Template upgrade, with an optional note for the Assistant. */
export function StartSessionDialog({ intent, onClose, onStart, pending }: Readonly<StartSessionDialogProps>) {
  const assistant = useAssistantLabel()
  const [note, setNote] = useState('')
  const focused = intent?.kind === 'focused'
  const title = focused ? `Grill “${intent.heading}”` : 'Upgrade to the latest Template'
  const explanation = focused ? focusedExplanation(assistant) : upgradeExplanation(assistant)
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
      <p className="mb-3 text-sm text-ink-soft">{explanation}</p>
      {intent && (
        <TextArea
          autoFocus
          minRows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={`What changed, or what should ${assistant} look at? (optional)`}
          aria-label={`Note for ${assistant}`}
        />
      )}
    </Dialog>
  )
}
