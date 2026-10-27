// The New Prototype form: an optional Draft (its Images ticked by default), Images to add, a running total against
// 20 MB, and an optional earlier Prototype of the Project to start from. 'Start grilling' opens a conversation;
// 'Write now' is today's single-turn session and needs a Draft. The same wherever it opens.
import { SESSION_IMAGE_WARNING_BYTES } from '#core/session/images.ts'

import { useDrafts } from '@/api/hooks/projects/projectHooks'
import type { PrototypeSessionInputs } from '@/api/prototypesApi'
import { Button } from '@/components/atoms/button/button'
import { DraftChooser } from '@/components/features/prototypes/draftChooser/draftChooser'
import { ExtraImages } from '@/components/features/prototypes/extraImages/extraImages'
import { StartFormImages } from '@/components/features/prototypes/startFormImages/startFormImages'
import { StartingPrototypePicker } from '@/components/features/prototypes/startingPrototypePicker/startingPrototypePicker'
import { usePrototypeStartForm } from '@/hooks/prototypes/usePrototypeStartForm'

interface PrototypeStartFormProps {
  projectId: string
  /** The Draft chosen when the form opens; none when it is not given. */
  draftId?: string
  onCancel: () => void
  /** What a Failed or Stopped session was started with, to open the form filled in again. */
  initial?: PrototypeSessionInputs
  /** A single-turn session has started; its row is on the list. */
  onStarted: () => void
}

const INTRO =
  'Start grilling to talk it through: Claude asks what the Prototype should show, writes it, and writes a new one for each round of feedback. Write now has Claude write one Prototype of a Draft as it stands, without asking you anything.'

const MEGABYTE = 1024 * 1024
const megabytes = (bytes: number) => (bytes / MEGABYTE).toFixed(1)

/** The New Prototype form; paste or drop anywhere on it adds an Image. */
export function PrototypeStartForm({
  projectId,
  draftId: initialDraftId,
  initial,
  onCancel,
  onStarted,
}: Readonly<PrototypeStartFormProps>) {
  const { data: drafts } = useDrafts(projectId)
  const form = usePrototypeStartForm({ projectId, initialDraftId, initial, onStarted })
  const total = `Images: ${megabytes(form.totalBytes)} MB of ${SESSION_IMAGE_WARNING_BYTES / MEGABYTE} MB`
  const blocked = form.loading || form.reason !== undefined || form.submitting

  return (
    <form
      aria-label="New Prototype"
      onSubmit={(event) => {
        event.preventDefault()
        form.startGrilling()
      }}
      {...form.attachments.textareaProps}
      className="space-y-4 rounded-lg border border-line bg-sheet p-4"
    >
      <p className="text-sm text-ink-soft">{INTRO}</p>
      {drafts !== undefined && (
        <DraftChooser drafts={drafts} writing={form.writing} value={form.draftId} onChange={form.setDraftId} />
      )}
      {form.draftImages.length > 0 && (
        <StartFormImages
          projectId={projectId}
          images={form.draftImages}
          isTicked={form.isTicked}
          onToggle={form.toggle}
        />
      )}
      <ExtraImages attachments={form.attachments} />
      {form.earlier.length > 0 && (
        <StartingPrototypePicker
          earlier={form.earlier}
          value={form.startingPrototypeId}
          onChange={form.setStartingPrototypeId}
        />
      )}
      <div className="space-y-1">
        <p className="text-[13px] text-ink-soft">{total}</p>
        {form.imagesError !== null && (
          <p role="alert" className="text-[13px] text-redpencil">
            {form.imagesError.message}
          </p>
        )}
        {form.reason !== undefined && (
          <p role="alert" className="text-[13px] text-redpencil">
            {form.reason}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button disabled={form.draftId === '' || blocked} onClick={form.startWriteNow}>
            Write now
          </Button>
          <Button type="submit" variant="claude" disabled={blocked}>
            Start grilling
          </Button>
        </div>
      </div>
    </form>
  )
}
