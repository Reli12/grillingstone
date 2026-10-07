// "Copy for Azure DevOps": the Publish Renderer's exact field values (ADR-0008), one button per field.
// Rich HTML goes to the clipboard so it pastes cleanly into ADO's rich-text boxes.
import { useState } from 'react'

import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { ADO_FIELD_LABELS, ADO_FIELDS } from '#core/shared/adoFields.ts'

import { useRendered } from '@/api/hooks/drafts/draftHooks'
import { Button } from '@/components/atoms/button/button'
import { Thinking } from '@/components/atoms/thinking/thinking'
import { Dialog } from '@/components/composite/dialog/dialog'

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

const plain = (html: string) => {
  const el = document.createElement('div')
  el.innerHTML = html.replace(/<br>/g, '\n').replace(/<\/(p|h2|h3|li|tr)>/g, '$&\n')
  return (el.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

interface CopyForAdoProps {
  projectId: string
  draftId: string
  open: boolean
  onClose: () => void
}

export function CopyForAdo({ projectId, draftId, open, onClose }: CopyForAdoProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const { data } = useRendered(projectId, draftId, open)

  const fields = data
    ? [
        { key: ADO_FIELDS.title, label: 'Title', html: null as string | null, text: data.title },
        ...Object.entries(data.fields)
          .sort(([a], [b]) =>
            a === ADO_FIELDS.description ? -1 : b === ADO_FIELDS.description ? 1 : a.localeCompare(b),
          )
          .map(([key, html]) => ({ key, label: ADO_FIELD_LABELS[key] ?? key, html, text: plain(html) })),
      ]
    : []

  return (
    <Dialog open={open} onClose={onClose} title="Copy for Azure DevOps" className="w-[min(860px,calc(100vw-32px))]">
      <p className="mb-4 text-sm text-ink-soft">
        Paste each field into its box on the work item. Discarded content is left out and your order is kept.
      </p>
      {!data ? (
        <Thinking label="Rendering" />
      ) : (
        <div className="space-y-5">
          {fields.map((f) => (
            <section key={f.key}>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="font-semibold">{f.label}</h3>
                <Button
                  size="sm"
                  variant={copied === f.key ? 'proof' : 'outline'}
                  onClick={async () => {
                    try {
                      await copy(f.html, f.text)
                      setCopied(f.key)
                      setTimeout(() => setCopied((c) => (c === f.key ? null : c)), 1800)
                    } catch {
                      toast.error('The browser refused clipboard access.')
                    }
                  }}
                >
                  {copied === f.key ? <Check size={14} /> : <Copy size={14} />}{' '}
                  {copied === f.key ? 'Copied' : `Copy ${f.label}`}
                </Button>
              </div>
              {f.html === null ? (
                <p className="rounded-md border border-line px-3 py-2 font-serif">{f.text}</p>
              ) : (
                <div
                  className="max-h-72 overflow-y-auto rounded-md border border-line px-4 py-3 font-serif text-[14px] leading-6 [&_h2]:mt-3 [&_h2]:font-sans [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_li]:ml-5 [&_p]:mt-1.5 [&_table]:mt-1.5 [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:bg-fog [&_th]:px-2 [&_ul]:list-disc"
                  // Rendered by the tool from escaped text (core/publish/publishRenderer.ts).
                  dangerouslySetInnerHTML={{ __html: f.html }}
                />
              )}
            </section>
          ))}
        </div>
      )}
    </Dialog>
  )
}
