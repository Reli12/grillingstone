// "Copy for <Tracker>": the Publish Renderer's exact field values (ADR-0008), one button per field, in the
// order the Tracker's form asks for them. Rich HTML goes to the clipboard so it pastes cleanly into rich-text
// boxes; for Jira, one switch turns every field into wiki markup for Data Center's Text mode.
import { useState } from 'react'

import { toast } from 'sonner'

import type { CopyField } from '#core/publish/copyFields.ts'
import { TRACKER_LABELS } from '#core/shared/tracker.ts'

import { useCopyFields } from '@/api/hooks/drafts/draftHooks'
import { Thinking } from '@/components/atoms/thinking/thinking'
import { Dialog } from '@/components/composite/dialog/dialog'
import { FieldPreview } from '@/components/features/draft/publish/fieldPreview/fieldPreview'
import { PasteFormatSwitch } from '@/components/features/draft/publish/pasteFormatSwitch/pasteFormatSwitch'
import type { PasteFormat } from '@/types/publish'

/** How long a button says "Copied" before it reads "Copy …" again. */
const COPIED_FEEDBACK_MS = 1800

const LINE_BREAK_TAG = /<br>/g // every <br> the renderer writes
const BLOCK_END_TAG = /<\/(p|h2|h3|li|tr)>/g // the closing tag of each block that ends a line of text
const THREE_OR_MORE_NEWLINES = /\n{3,}/g // runs of blank lines left between blocks

/** The plain-text version of a field's HTML, one line per block, for pastes that drop formatting. */
const plain = (html: string) => {
  const container = document.createElement('div')
  container.innerHTML = html.replace(LINE_BREAK_TAG, '\n').replace(BLOCK_END_TAG, '$&\n')
  const text = container.textContent ?? ''
  return text.replace(THREE_OR_MORE_NEWLINES, '\n\n').trim()
}

/** Puts the field on the clipboard: wiki markup as plain text, or rich HTML with a plain-text fallback. */
async function copy(field: CopyField, format: PasteFormat) {
  if (field.html === null) return navigator.clipboard.writeText(field.text)
  if (format === 'wiki' && field.wiki !== null) return navigator.clipboard.writeText(field.wiki)
  if (!('ClipboardItem' in window)) return navigator.clipboard.writeText(plain(field.html))
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([field.html], { type: 'text/html' }),
      'text/plain': new Blob([plain(field.html)], { type: 'text/plain' }),
    }),
  ])
}

interface CopyForTrackerProps {
  projectId: string
  draftId: string
  open: boolean
  onClose: () => void
}

export function CopyForTracker({ projectId, draftId, open, onClose }: Readonly<CopyForTrackerProps>) {
  const [copied, setCopied] = useState<string | null>(null)
  const [format, setFormat] = useState<PasteFormat>('rich')

  const { data } = useCopyFields(projectId, draftId, open)
  const trackerName = data ? TRACKER_LABELS[data.tracker] : ''

  const copyField = async (field: CopyField) => {
    try {
      await copy(field, format)
      setCopied(field.field)
      // Clear the mark later, unless another field has been copied since.
      setTimeout(() => setCopied((current) => (current === field.field ? null : current)), COPIED_FEEDBACK_MS)
    } catch {
      toast.error('The browser refused clipboard access.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={data ? `Copy for ${trackerName}` : 'Copy'}
      className="w-[min(860px,calc(100vw-32px))]"
    >
      <p className="mb-4 text-sm text-ink-soft">
        Paste each field into its box on the {trackerName} work item. Discarded content is left out and your order is
        kept.
      </p>
      {!data ? (
        <Thinking label="Rendering" />
      ) : (
        <div className="space-y-5">
          {data.tracker === 'jira' && <PasteFormatSwitch value={format} onChange={setFormat} />}
          {data.fields.map((field) => (
            <FieldPreview
              key={field.field}
              field={field}
              format={format}
              copied={copied === field.field}
              onCopy={() => void copyField(field)}
            />
          ))}
        </div>
      )}
    </Dialog>
  )
}
