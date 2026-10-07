// Importing a colleague's bundle: every Template is marked new, changed or identical by meaning; only new
// ones are selected by default, and an import never deletes anything.
import { useState } from 'react'

import { toast } from 'sonner'

import { useImportPreview, useImportTemplates } from '@/api/hooks/templates/templateHooks'
import { Dialog } from '@/components/composite/dialog/dialog'
import { ImportActions } from '@/components/features/templates/importActions/importActions'
import { ImportList } from '@/components/features/templates/importList/importList'

/** The set with the index removed if it was there, or added if it was not. */
function toggled(indexes: Set<number>, index: number) {
  const next = new Set(indexes)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  return next
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
