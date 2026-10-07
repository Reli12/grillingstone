// "Copy for Azure DevOps": the Publish Renderer's exact field values (ADR-0008), one button per field.
// Rich HTML goes to the clipboard so it pastes cleanly into ADO's rich-text boxes.
import { useState } from 'react'

import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

import type { Rendered } from '#core/publish/publishRenderer.ts'
import { ADO_FIELD_LABELS, ADO_FIELDS } from '#core/shared/adoFields.ts'

import { useRendered } from '@/api/hooks/drafts/draftHooks'
import { Button } from '@/components/atoms/button/button'
import { Thinking } from '@/components/atoms/thinking/thinking'
import { Dialog } from '@/components/composite/dialog/dialog'

/** How long a button says "Copied" before it reads "Copy …" again. */
const COPIED_FEEDBACK_MS = 1800

const LINE_BREAK_TAG = /<br>/g // every <br> the renderer writes
const BLOCK_END_TAG = /<\/(p|h2|h3|li|tr)>/g // the closing tag of each block that ends a line of text
const THREE_OR_MORE_NEWLINES = /\n{3,}/g // runs of blank lines left between blocks

/** One field of the work item, ready to copy: HTML for ADO's rich-text boxes, `null` for plain ones. */
interface CopyField {
  key: string
  label: string
  html: string | null
  text: string
}

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

interface FieldPreviewProps {
  field: CopyField
  copied: boolean
  onCopy: () => void
}

function FieldPreview({ field, copied, onCopy }: Readonly<FieldPreviewProps>) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="font-semibold">{field.label}</h3>
        <Button size="sm" variant={copied ? 'proof' : 'outline'} onClick={onCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : `Copy ${field.label}`}
        </Button>
      </div>
      {field.html === null ? (
        <p className="rounded-md border border-line px-3 py-2 font-serif">{field.text}</p>
      ) : (
        <div
          className="max-h-72 overflow-y-auto rounded-md border border-line px-4 py-3 font-serif text-[14px] leading-6 [&_h2]:mt-3 [&_h2]:font-sans [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_li]:ml-5 [&_p]:mt-1.5 [&_table]:mt-1.5 [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:bg-fog [&_th]:px-2 [&_ul]:list-disc"
          // Rendered by the tool from escaped text (core/publish/publishRenderer.ts).
          dangerouslySetInnerHTML={{ __html: field.html }}
        />
      )}
    </section>
  )
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
