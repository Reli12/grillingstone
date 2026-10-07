// Importing a colleague's bundle: every Template is marked new, changed or identical by meaning; only new
// ones are selected by default, and an import never deletes anything.
import { useState } from 'react'

import { toast } from 'sonner'

import type { ImportItem, ImportStatus } from '#core/template/templateBundle.ts'

import { useImportPreview, useImportTemplates } from '@/api/hooks/templates/templateHooks'
import { Button } from '@/components/atoms/button/button'
import { Tag } from '@/components/atoms/tag/tag'
import { Dialog } from '@/components/composite/dialog/dialog'

const STATUS: Record<ImportStatus, { tone: 'proof' | 'mark' | 'neutral'; text: string }> = {
  new: { tone: 'proof', text: 'New' },
  changed: { tone: 'mark', text: 'Changed' },
  identical: { tone: 'neutral', text: 'Identical' },
}

/** The set with the index removed if it was there, or added if it was not. */
function toggled(indexes: Set<number>, index: number) {
  const next = new Set(indexes)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  return next
}

interface ImportListProps {
  items: ImportItem[]
  selected: Set<number>
  onToggle: (index: number) => void
}

/** Each Template in the bundle with its status; identical ones can't be ticked, there is nothing to import. */
function ImportList({ items, selected, onToggle }: Readonly<ImportListProps>) {
  return (
    <>
      <p className="mb-3 text-sm text-ink-soft">
        Changed Templates of yours are replaced only if you tick them; a changed Default arrives as a copy. Nothing you
        have is deleted.
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-sm hover:border-ink-faint has-[:disabled]:cursor-default has-[:disabled]:opacity-60">
              <input
                type="checkbox"
                className="accent-claude"
                disabled={item.status === 'identical'}
                checked={selected.has(i)}
                onChange={() => onToggle(i)}
              />
              <span className="w-14 text-ink-faint">{item.template.workItemType}</span>
              <span className="flex-1 font-medium">{item.template.name}</span>
              <Tag tone={STATUS[item.status].tone}>{STATUS[item.status].text}</Tag>
            </label>
          </li>
        ))}
      </ul>
    </>
  )
}

interface ImportActionsProps {
  count: number
  canImport: boolean
  onCancel: () => void
  onImport: () => void
}

function ImportActions({ count, canImport, onCancel, onImport }: Readonly<ImportActionsProps>) {
  return (
    <>
      <Button variant="quiet" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="ink" disabled={!canImport} onClick={onImport}>
        Import {count || ''}
      </Button>
    </>
  )
}

interface ImportDialogProps {
  bundle: unknown
  onClose: () => void
}

export function ImportDialog({ bundle, onClose }: Readonly<ImportDialogProps>) {
  // The user's ticks, remembered per bundle; until they tick anything the preview's defaults apply.
  const [ticked, setTicked] = useState<{ bundle: unknown; indexes: Set<number> } | null>(null)

  const { data, error } = useImportPreview(bundle)
  const importMutation = useImportTemplates()

  // A failed preview request reads like a refused bundle: the reason is shown in place of the list.
  const preview = error ? { ok: false as const, reason: error.message } : data
  const defaults = preview?.ok
    ? new Set(preview.items.flatMap((item, i) => (item.selected ? [i] : [])))
    : new Set<number>()
  const selected = ticked && ticked.bundle === bundle ? ticked.indexes : defaults
  const toggle = (index: number) => setTicked({ bundle, indexes: toggled(selected, index) })

  const runImport = () =>
    importMutation.mutate(
      { bundle, selected: [...selected] },
      {
        onSuccess: (written) => {
          toast.success(`Imported ${written.length} Template${written.length === 1 ? '' : 's'}.`)
          onClose()
        },
      },
    )
  const canImport = !!preview?.ok && selected.size > 0 && !importMutation.isPending

  return (
    <Dialog
      open={bundle !== null}
      onClose={onClose}
      title="Import Templates"
      footer={<ImportActions count={selected.size} canImport={canImport} onCancel={onClose} onImport={runImport} />}
    >
      {!preview && <p className="text-sm text-ink-soft">Reading the bundle…</p>}
      {preview && !preview.ok && <p className="text-sm text-redpencil">{preview.reason}</p>}
      {preview?.ok && <ImportList items={preview.items} selected={selected} onToggle={toggle} />}
    </Dialog>
  )
}
