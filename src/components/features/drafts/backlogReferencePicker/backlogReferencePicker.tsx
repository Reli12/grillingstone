// New Draft: the Backlog Copies this Draft derives from, as chips. Add an existing Copy from the menu, or paste a
// new one in a dialog — it is created together with the Draft. Azure DevOps Projects only.
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { ClipboardPaste, FileText, Plus, X } from 'lucide-react'

import { createBacklogCopy, parseWorkItemId, type PastedCopy } from '#core/backlog/backlogCopy.ts'

import { useBacklogCopies } from '@/api/hooks/backlogCopies/backlogCopyHooks'
import { Button } from '@/components/atoms/button/button'
import { FieldLabel } from '@/components/atoms/fieldLabel/fieldLabel'
import { PasteCopyDialog } from '@/components/features/backlogCopies/pasteCopyDialog/pasteCopyDialog'
import { useCloseOnOutsidePress } from '@/hooks/shared/useCloseOnOutsidePress'

interface BacklogReferencePickerProps {
  projectId: string
  /** Ids of existing Backlog Copies picked. */
  picked: string[]
  /** Copies pasted in this form, not saved yet. */
  pasted: PastedCopy[]
  onToggle: (copyId: string) => void
  onPaste: (pasted: PastedCopy) => void
  onRemovePasted: (index: number) => void
}

function Chip({ label, onRemove }: Readonly<{ label: string; onRemove: () => void }>) {
  return (
    <li className="flex items-center gap-2 rounded-md bg-claude-wash px-2.5 py-1.5 text-sm">
      <FileText size={14} className="shrink-0 text-claude" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="text-ink-faint hover:text-ink">
        <X size={13} />
      </button>
    </li>
  )
}

/** Why a pasted Copy cannot be added: invalid, already a Copy in the Project, or already pasted in this form. */
function refusal(values: PastedCopy, takenIds: number[]): { message: string; existingWorkItemId?: number } | null {
  const result = createBacklogCopy(values, new Date().toISOString())
  if (!result.ok) return { message: result.reasons.map((reason) => reason.message).join(' ') }
  if (takenIds.includes(result.copy.workItemId))
    return {
      message: `Work item #${result.copy.workItemId} is already a Backlog Copy in this Project.`,
      existingWorkItemId: result.copy.workItemId,
    }
  return null
}

export function BacklogReferencePicker({
  projectId,
  picked,
  pasted,
  onToggle,
  onPaste,
  onRemovePasted,
}: Readonly<BacklogReferencePickerProps>) {
  const { data: summaries = [] } = useBacklogCopies(projectId)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [problem, setProblem] = useState<ReturnType<typeof refusal>>(null)
  const container = useCloseOnOutsidePress(menuOpen, setMenuOpen)
  const copies = summaries.map((summary) => summary.copy)
  const pickedCopies = copies.filter((copy) => picked.includes(copy.id))
  const pastedIds = pasted.flatMap((item) => {
    const parsed = parseWorkItemId(item.workItem)
    return parsed.ok ? [parsed.workItemId] : []
  })
  const existing = copies.find((copy) => copy.workItemId === problem?.existingWorkItemId)

  const closePaste = () => {
    setPasting(false)
    setProblem(null)
  }
  const submitPaste = (values: PastedCopy) => {
    const refused = refusal(values, [...copies.map((copy) => copy.workItemId), ...pastedIds])
    if (refused) return setProblem(refused)
    onPaste(values)
    closePaste()
  }

  return (
    <div>
      <FieldLabel hint="Azure DevOps work items this Draft derives from. The first session reads them in full.">
        Backlog References
      </FieldLabel>
      <ul className="space-y-1.5">
        {pickedCopies.map((copy) => (
          <Chip key={copy.id} label={`#${copy.workItemId} ${copy.title}`} onRemove={() => onToggle(copy.id)} />
        ))}
        {pasted.map((item, index) => (
          <Chip
            key={`${item.workItem}-${index}`}
            label={`${item.workItem.trim()} ${item.title.trim()} (new)`}
            onRemove={() => onRemovePasted(index)}
          />
        ))}
      </ul>
      <div ref={container} className="relative mt-2">
        <Button size="sm" variant="quiet" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <Plus size={14} /> Add Backlog Reference
        </Button>
        {menuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-line bg-sheet p-1 shadow-lg">
            {copies.length === 0 && <p className="px-2 py-1.5 text-[13px] text-ink-faint">No Backlog Copies yet.</p>}
            {copies.map((copy) => (
              <label
                key={copy.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-fog"
              >
                <input
                  type="checkbox"
                  className="accent-claude"
                  checked={picked.includes(copy.id)}
                  onChange={() => onToggle(copy.id)}
                />
                <span className="font-mono text-ink-faint">#{copy.workItemId}</span>
                <span className="truncate">{copy.title}</span>
              </label>
            ))}
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2 border-t border-line-soft px-2 py-1.5 text-left text-sm text-claude"
              onClick={() => {
                setMenuOpen(false)
                setPasting(true)
              }}
            >
              <ClipboardPaste size={14} /> Paste a new one…
            </button>
          </div>
        )}
      </div>
      {/* Outside the New Draft <form>, so Enter in the dialog never submits the Draft. */}
      {pasting &&
        createPortal(
          <PasteCopyDialog
            onClose={closePaste}
            submitLabel="Add and reference"
            error={problem?.message}
            notice={
              existing && (
                <Button
                  size="sm"
                  variant="claude"
                  onClick={() => {
                    if (!picked.includes(existing.id)) onToggle(existing.id)
                    closePaste()
                  }}
                >
                  Reference #{existing.workItemId} instead
                </Button>
              )
            }
            onSubmit={submitPaste}
          />,
          document.body,
        )}
    </div>
  )
}
