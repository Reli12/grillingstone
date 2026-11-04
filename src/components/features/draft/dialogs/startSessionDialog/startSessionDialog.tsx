// Confirms starting a Focused Session or a Template upgrade, with an optional note for Claude, and what code it reads.
import { useState } from 'react'

import { Button } from '@/components/atoms/button/button'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { Dialog } from '@/components/composite/dialog/dialog'
import { SessionCodeChoice } from '@/components/features/codeFolders/sessionCodeChoice/sessionCodeChoice'

/** Sessions started from a dialog; plain New Iterations start by typing in the chat. */
export type StartIntent =
  { kind: 'focused'; sectionId: string; entryId?: string; heading: string } | { kind: 'upgrade' }

const FOCUSED_EXPLANATION =
  'Claude grills only this part, starting from the current Draft and Glossary. It returns a Proposal and may suggest knock-on changes elsewhere — nothing changes until you accept.'
const UPGRADE_EXPLANATION =
  'Claude proposes the Sections the newer Template adds and any rewrites its method requires. You triage it like any Proposal.'

interface StartSessionDialogProps {
  intent: StartIntent | null
  onClose: () => void
  /** includeBacklogInFull: list or include Backlog References; readCodeFolders: the "Code this session reads" choice. */
  onStart: (note: string, includeBacklogInFull: boolean, readCodeFolders: boolean) => void
  pending: boolean
  /** The Draft's Backlog References, and how many of their Copies changed since its last session. */
  backlog?: { count: number; changed: number }
  /** The Project, whose Code Folders the session may read; without it the choice is not offered. */
  projectId?: string
}

/** Later sessions only list Backlog References; this asks for them in full. Changed Copies come in full anyway. */
function IncludeInFull({
  backlog,
  checked,
  onChange,
}: Readonly<{ backlog: { count: number; changed: number }; checked: boolean; onChange: (on: boolean) => void }>) {
  const plural = backlog.changed === 1 ? 'changed Backlog Copy is' : 'changed Backlog Copies are'
  return (
    <div className="mt-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-claude"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        Include Backlog References in full
      </label>
      <p className="mt-1 pl-6 text-[13px] text-ink-faint">
        Otherwise Claude gets them listed and reads one when it matters.
        {backlog.changed > 0 && ` The ${backlog.changed} ${plural} included in full anyway, with what changed.`}
      </p>
    </div>
  )
}

/** Confirms a Focused Session or Template upgrade, with an optional note for Claude. */
export function StartSessionDialog({
  intent,
  onClose,
  onStart,
  pending,
  backlog = { count: 0, changed: 0 },
  projectId,
}: Readonly<StartSessionDialogProps>) {
  const [note, setNote] = useState('')
  const [inFull, setInFull] = useState(false)
  const [readCode, setReadCode] = useState(true)
  const focused = intent?.kind === 'focused'
  const title = focused ? `Grill “${intent.heading}”` : 'Upgrade to the latest Template'
  const explanation = focused ? FOCUSED_EXPLANATION : UPGRADE_EXPLANATION
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
          <Button variant="claude" disabled={pending} onClick={() => onStart(note, inFull, readCode)}>
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
          placeholder="What changed, or what should Claude look at? (optional)"
          aria-label="Note for Claude"
        />
      )}
      {intent && backlog.count > 0 && <IncludeInFull backlog={backlog} checked={inFull} onChange={setInFull} />}
      {intent && projectId && (
        <SessionCodeChoice projectId={projectId} read={readCode} onChange={setReadCode} className="mt-3" />
      )}
    </Dialog>
  )
}
