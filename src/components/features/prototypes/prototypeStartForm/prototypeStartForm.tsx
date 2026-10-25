// The Prototype start form, keyed by Draft: the Draft's Images ticked by default, Images to add, a running total
// against 20 MB, and an optional earlier Prototype to start from. The same wherever it opens.
import { SESSION_IMAGE_WARNING_BYTES } from '#core/session/images.ts'

import { useDraftImages, usePrototypeRows } from '@/api/hooks/prototypes/prototypeHooks'
import type { PrototypeSessionInputs } from '@/api/prototypesApi'
import { Button } from '@/components/atoms/button/button'
import { ExtraImages } from '@/components/features/prototypes/extraImages/extraImages'
import { StartFormImages } from '@/components/features/prototypes/startFormImages/startFormImages'
import { StartingPrototypePicker } from '@/components/features/prototypes/startingPrototypePicker/startingPrototypePicker'
import { usePrototypeStartForm } from '@/hooks/prototypes/usePrototypeStartForm'

interface PrototypeStartFormProps {
  projectId: string
  draftId: string
  onCancel: () => void
  /** What a Failed or Stopped session was started with, to open the form filled in again. */
  initial?: PrototypeSessionInputs
  /** The session has started; its row is on the list. */
  onStarted: () => void
}

const MEGABYTE = 1024 * 1024
const megabytes = (bytes: number) => (bytes / MEGABYTE).toFixed(1)

/** The Prototype start form for one Draft; paste or drop anywhere on it adds an Image. */
export function PrototypeStartForm({
  projectId,
  draftId,
  initial,
  onCancel,
  onStarted,
}: Readonly<PrototypeStartFormProps>) {
  const { data: images, error } = useDraftImages(projectId, draftId)
  const { data: rows } = usePrototypeRows(projectId, draftId)
  const draftImages = images ?? []
  const earlier = (rows ?? []).flatMap((row) => (row.kind === 'finished' ? [row.prototype] : []))
  const form = usePrototypeStartForm({ projectId, draftId, images: draftImages, earlier, initial, onStarted })
  const total = `Images: ${megabytes(form.totalBytes)} MB of ${SESSION_IMAGE_WARNING_BYTES / MEGABYTE} MB`

  return (
    <form
      aria-label="New Prototype"
      onSubmit={(event) => {
        event.preventDefault()
        form.submit()
      }}
      {...form.attachments.textareaProps}
      className="space-y-4 rounded-lg border border-line bg-sheet p-4"
    >
      <p className="text-sm text-ink-soft">
        Claude writes one clickable Prototype of this Draft as it stands now. It won’t ask you anything.
      </p>
      {draftImages.length > 0 && (
        <StartFormImages projectId={projectId} images={draftImages} isTicked={form.isTicked} onToggle={form.toggle} />
      )}
      <ExtraImages attachments={form.attachments} />
      {earlier.length > 0 && (
        <StartingPrototypePicker
          earlier={earlier}
          value={form.startingPrototypeId}
          onChange={form.setStartingPrototypeId}
        />
      )}
      <div className="space-y-1">
        <p className="text-[13px] text-ink-soft">{total}</p>
        {error && (
          <p role="alert" className="text-[13px] text-redpencil">
            {error.message}
          </p>
        )}
        {form.reason && (
          <p role="alert" className="text-[13px] text-redpencil">
            {form.reason}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            type="submit"
            variant="claude"
            disabled={images === undefined || rows === undefined || form.reason !== undefined || form.submitting}
          >
            Submit
          </Button>
        </div>
      </div>
    </form>
  )
}
