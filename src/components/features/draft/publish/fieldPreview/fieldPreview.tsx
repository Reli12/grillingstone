// One Azure DevOps field in "Copy for Azure DevOps": its rendered preview and its copy button.
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import type { CopyField } from '@/types/publish'

interface FieldPreviewProps {
  field: CopyField
  copied: boolean
  onCopy: () => void
}

export function FieldPreview({ field, copied, onCopy }: Readonly<FieldPreviewProps>) {
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
