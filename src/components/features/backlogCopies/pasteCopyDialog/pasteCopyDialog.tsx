// Pasting a Backlog Copy, or re-pasting one: the work item's ID or link, type, title, description and optional
// Acceptance Criteria. What happens with the values is the caller's call (save it now, or keep it for a new Draft).
import { type ReactNode, useId, useState } from 'react'

import type { BacklogCopy, PastedCopy } from '#core/backlog/backlogCopy.ts'
import { workItemTypes } from '#core/shared/workItemType.ts'

import { Button } from '@/components/atoms/button/button'
import { FieldError } from '@/components/atoms/fieldError/fieldError'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { TextArea } from '@/components/atoms/textArea/textArea'
import { fieldClass, TextInput } from '@/components/atoms/textInput/textInput'
import { Dialog } from '@/components/composite/dialog/dialog'
import { cn } from '@/lib/cn'

interface PasteCopyDialogProps {
  onClose: () => void
  onSubmit: (values: PastedCopy) => void
  /** Re-pasting this Copy; without it a new Copy is pasted. */
  copy?: BacklogCopy
  /** How many Drafts a re-paste flags. */
  referencingCount?: number
  submitLabel?: string
  pending?: boolean
  error?: string
  /** Shown under the error, e.g. the offer to re-paste a work item that is already a Copy. */
  notice?: ReactNode
}

const ADO_TYPES = workItemTypes('azure-devops')

/** Mounted only while open, so every opening starts from the Copy (or empty). */
export function PasteCopyDialog({
  onClose,
  onSubmit,
  copy,
  referencingCount = 0,
  submitLabel,
  pending,
  error,
  notice,
}: Readonly<PasteCopyDialogProps>) {
  const ids = useId()
  const [values, setValues] = useState<PastedCopy>({
    workItem: copy ? String(copy.workItemId) : '',
    workItemType: copy?.workItemType ?? 'Feature',
    title: copy?.title ?? '',
    content: copy?.content ?? '',
    acceptanceCriteria: copy?.acceptanceCriteria ?? '',
  })
  const set = (key: keyof PastedCopy) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))
  const ready = !!values.workItem.trim() && !!values.title.trim() && !!values.content.trim()
  const flagged = `${referencingCount} Draft${referencingCount === 1 ? '' : 's'}`

  return (
    <Dialog
      open
      onClose={onClose}
      title={copy ? `Re-paste #${copy.workItemId}` : 'Paste a Backlog Copy'}
      className="w-[min(720px,calc(100vw-32px))]"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="claude" disabled={!ready || pending} onClick={() => onSubmit(values)}>
            {submitLabel ?? (copy ? 'Re-paste' : 'Save Backlog Copy')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {copy ? (
          <p className="text-sm text-ink-soft">
            {referencingCount
              ? `${flagged} reference it and will be flagged, so their next session gets the new text and what changed.`
              : 'No Draft references it yet.'}{' '}
            The same text again changes nothing.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
            <div>
              <FieldLabel htmlFor={`${ids}-item`}>Work item ID or link</FieldLabel>
              <TextInput
                id={`${ids}-item`}
                autoFocus
                value={values.workItem}
                onChange={set('workItem')}
                placeholder="1234, #1234 or https://dev.azure.com/…/_workitems/edit/1234"
              />
            </div>
            <div>
              <FieldLabel htmlFor={`${ids}-type`}>Work Item Type</FieldLabel>
              <select
                id={`${ids}-type`}
                value={values.workItemType}
                onChange={set('workItemType')}
                className={cn(fieldClass, 'h-9 text-sm')}
              >
                {ADO_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div>
          <FieldLabel htmlFor={`${ids}-title`}>Title</FieldLabel>
          <TextInput id={`${ids}-title`} value={values.title} onChange={set('title')} placeholder="Device archiving" />
        </div>
        <div>
          <FieldLabel htmlFor={`${ids}-content`}>Description</FieldLabel>
          <TextArea
            id={`${ids}-content`}
            minRows={6}
            value={values.content}
            onChange={set('content')}
            placeholder="Paste the work item's description and business rules…"
          />
        </div>
        <div>
          <FieldLabel
            htmlFor={`${ids}-ac`}
            hint="Optional. Paste them if the work item has a separate Acceptance Criteria field."
          >
            Acceptance Criteria
          </FieldLabel>
          <TextArea
            id={`${ids}-ac`}
            minRows={3}
            value={values.acceptanceCriteria}
            onChange={set('acceptanceCriteria')}
            placeholder="AC1 — Given…, when…, then…"
          />
        </div>
        <FieldError message={error} />
        {notice}
      </div>
    </Dialog>
  )
}
