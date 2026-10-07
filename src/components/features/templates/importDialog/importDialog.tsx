// Importing a colleague's bundle: every Template is marked new, changed or identical by meaning; only new
// ones are selected by default, and an import never deletes anything.
import { useState } from 'react'

import { toast } from 'sonner'

import type { ImportStatus } from '#core/template/templateBundle.ts'

import { useImportPreview, useImportTemplates } from '@/api/hooks/templates/templateHooks'
import { Button } from '@/components/atoms/button/button'
import { Tag } from '@/components/atoms/tag/tag'
import { Dialog } from '@/components/composite/dialog/dialog'

const STATUS: Record<ImportStatus, { tone: 'proof' | 'mark' | 'neutral'; text: string }> = {
  new: { tone: 'proof', text: 'New' },
  changed: { tone: 'mark', text: 'Changed' },
  identical: { tone: 'neutral', text: 'Identical' },
}

interface ImportDialogProps {
  bundle: unknown
  onClose: () => void
}

export function ImportDialog({ bundle, onClose }: ImportDialogProps) {
  // The user's ticks, remembered per bundle; until they tick anything the preview's defaults apply.
  const [ticked, setTicked] = useState<{ bundle: unknown; indexes: Set<number> } | null>(null)

  const { data, error } = useImportPreview(bundle)
  const importMutation = useImportTemplates()

  const preview = error ? { ok: false as const, reason: error.message } : data
  const defaults = preview?.ok
    ? new Set(preview.items.flatMap((item, i) => (item.selected ? [i] : [])))
    : new Set<number>()
  const selected = ticked && ticked.bundle === bundle ? ticked.indexes : defaults
  const setSelected = (indexes: Set<number>) => setTicked({ bundle, indexes })

  return (
    <Dialog
      open={bundle !== null}
      onClose={onClose}
      title="Import Templates"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="ink"
            disabled={!preview?.ok || selected.size === 0 || importMutation.isPending}
            onClick={() =>
              importMutation.mutate(
                { bundle, selected: [...selected] },
                {
                  onSuccess: (written) => {
                    toast.success(`Imported ${written.length} Template${written.length === 1 ? '' : 's'}.`)
                    onClose()
                  },
                },
              )
            }
          >
            Import {selected.size || ''}
          </Button>
        </>
      }
    >
      {!preview && <p className="text-sm text-ink-soft">Reading the bundle…</p>}
      {preview && !preview.ok && <p className="text-sm text-redpencil">{preview.reason}</p>}
      {preview?.ok && (
        <>
          <p className="mb-3 text-sm text-ink-soft">
            Changed Templates of yours are replaced only if you tick them; a changed Default arrives as a copy. Nothing
            you have is deleted.
          </p>
          <ul className="space-y-1.5">
            {preview.items.map((item, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-sm hover:border-ink-faint has-[:disabled]:cursor-default has-[:disabled]:opacity-60">
                  <input
                    type="checkbox"
                    className="accent-claude"
                    disabled={item.status === 'identical'}
                    checked={selected.has(i)}
                    onChange={() => {
                      const next = new Set(selected)
                      if (next.has(i)) next.delete(i)
                      else next.add(i)
                      setSelected(next)
                    }}
                  />
                  <span className="w-14 text-ink-faint">{item.template.workItemType}</span>
                  <span className="flex-1 font-medium">{item.template.name}</span>
                  <Tag tone={STATUS[item.status].tone}>{STATUS[item.status].text}</Tag>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  )
}
