// "Copy for Azure DevOps": the Publish Renderer's exact field values (ADR-0008), one button per field.
// Rich HTML goes to the clipboard so it pastes cleanly into ADO's rich-text boxes.
import { useState } from 'react'

import { toast } from 'sonner'

import type { Rendered } from '#core/publish/publishRenderer.ts'
import { ADO_FIELD_LABELS, ADO_FIELDS } from '#core/shared/adoFields.ts'

import { useRendered } from '@/api/hooks/drafts/draftHooks'
import { Thinking } from '@/components/atoms/thinking/thinking'
import { Dialog } from '@/components/composite/dialog/dialog'
import { FieldPreview } from '@/components/features/draft/publish/fieldPreview/fieldPreview'
import type { CopyField } from '@/types/publish'

/** How long a button says "Copied" before it reads "Copy …" again. */
const COPIED_FEEDBACK_MS = 1800

const LINE_BREAK_TAG = /<br>/g // every <br> the renderer writes
const BLOCK_END_TAG = /<\/(p|h2|h3|li|tr)>/g // the closing tag of each block that ends a line of text
const THREE_OR_MORE_NEWLINES = /\n{3,}/g // runs of blank lines left between blocks

/** Puts rich HTML on the clipboard with a plain-text fallback, or plain text alone where the browser can't. */
async function copy(html: string | null, text: string) {
  if (html !== null && 'ClipboardItem' in window) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ])
  } else await navigator.clipboard.writeText(text)
}

/** The plain-text version of a field's HTML, one line per block, for pastes that drop formatting. */
const plain = (html: string) => {
  const container = document.createElement('div')
  container.innerHTML = html.replace(LINE_BREAK_TAG, '\n').replace(BLOCK_END_TAG, '$&\n')
  const text = container.textContent ?? ''
  return text.replace(THREE_OR_MORE_NEWLINES, '\n\n').trim()
}

/** Description first, as on the ADO form; the other fields alphabetically by reference name. */
function descriptionFirst([left]: [string, string], [right]: [string, string]) {
  if (left === ADO_FIELDS.description) return -1
  if (right === ADO_FIELDS.description) return 1
  return left.localeCompare(right)
}

/** The Title, then each rich-text field in ADO's order. */
function copyFields(rendered: Rendered): CopyField[] {
  const title: CopyField = { key: ADO_FIELDS.title, label: 'Title', html: null, text: rendered.title }
  const richFields = Object.entries(rendered.fields)
    .sort(descriptionFirst)
    .map(([key, html]) => ({ key, label: ADO_FIELD_LABELS[key] ?? key, html, text: plain(html) }))
  return [title, ...richFields]
}

interface CopyForAdoProps {
  projectId: string
  draftId: string
  open: boolean
  onClose: () => void
}

export function CopyForAdo({ projectId, draftId, open, onClose }: Readonly<CopyForAdoProps>) {
  const [copied, setCopied] = useState<string | null>(null)

  const { data } = useRendered(projectId, draftId, open)

  const fields = data ? copyFields(data) : []

  const copyField = async (field: CopyField) => {
    try {
      await copy(field.html, field.text)
      setCopied(field.key)
      // Clear the mark later, unless another field has been copied since.
      setTimeout(() => setCopied((current) => (current === field.key ? null : current)), COPIED_FEEDBACK_MS)
    } catch {
      toast.error('The browser refused clipboard access.')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Copy for Azure DevOps" className="w-[min(860px,calc(100vw-32px))]">
      <p className="mb-4 text-sm text-ink-soft">
        Paste each field into its box on the work item. Discarded content is left out and your order is kept.
      </p>
      {!data ? (
        <Thinking label="Rendering" />
      ) : (
        <div className="space-y-5">
          {fields.map((field) => (
            <FieldPreview
              key={field.key}
              field={field}
              copied={copied === field.key}
              onCopy={() => void copyField(field)}
            />
          ))}
        </div>
      )}
    </Dialog>
  )
}
