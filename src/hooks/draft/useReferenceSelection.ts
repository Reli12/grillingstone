// The References dialog's staged choice: which other Drafts and which Backlog Copies the Draft references, and its
// Parent. Nothing is saved until the human presses Save; the Draft as saved is the baseline every change is measured
// against.
import { useMemo, useState } from 'react'

import { backlogReferencesOf, parentReference } from '#core/backlog/backlogReference.ts'
import type { Draft } from '#core/draft/draftTypes.ts'

import { useSetParent } from '@/api/hooks/ado/adoHooks'
import { useBacklogCopies } from '@/api/hooks/backlogCopies/backlogCopyHooks'
import { useSetBacklogReferences, useSetReferences } from '@/api/hooks/drafts/draftHooks'
import { useDrafts } from '@/api/hooks/projects/projectHooks'

/** One row of the dialog: another written Draft, or a Backlog Copy. */
export interface ReferenceItem {
  id: string
  kind: 'draft' | 'backlog'
  type: string
  title: string
  /** Backlog Copies only. */
  workItemId?: number
  /** Drafts only. */
  archived: boolean
  /** Drafts only: its Lane. */
  lane?: string
}

export type ReferenceChange = 'added' | 'removed' | 'parent'

/** "#1234 Title" for a Backlog Copy, the title for a Draft. */
export const referenceName = (item: ReferenceItem) =>
  item.workItemId ? `#${item.workItemId} ${item.title}` : item.title

const sameSet = (first: Set<string>, second: Set<string>) =>
  first.size === second.size && [...first].every((id) => second.has(id))

function useReferenceItems(draft: Draft, withBacklog: boolean): ReferenceItem[] {
  const { data: drafts } = useDrafts(draft.projectId)
  const { data: copies } = useBacklogCopies(draft.projectId, withBacklog)
  return useMemo(
    () => [
      // Only Drafts with a written version have anything to read.
      ...(drafts ?? [])
        .filter((other) => other.id !== draft.id && other.version > 0)
        .map((other) => ({
          id: other.id,
          kind: 'draft' as const,
          type: other.workItemType,
          title: other.title,
          archived: other.archived,
          lane: other.lane,
        })),
      ...(withBacklog ? (copies ?? []) : []).map(({ copy }) => ({
        id: copy.id,
        kind: 'backlog' as const,
        type: copy.workItemType,
        title: copy.title,
        workItemId: copy.workItemId,
        archived: false,
      })),
    ],
    [drafts, copies, draft.id, withBacklog],
  )
}

/** Mount it only while the dialog is open: it starts from the Draft as saved each time. */
export function useReferenceSelection(draft: Draft, withBacklog: boolean) {
  const items = useReferenceItems(draft, withBacklog)
  const savedDrafts = useMemo(() => new Set(draft.references), [draft.references])
  const savedBacklog = useMemo(() => new Set(backlogReferencesOf(draft).map((ref) => ref.copyId)), [draft])
  const savedParent = parentReference(draft)?.copyId ?? null
  // Ids the list does not show (a deleted Copy, an unwritten Draft) stay as they are: only listed rows change.
  const [drafts, setDrafts] = useState(() => new Set(savedDrafts))
  const [backlog, setBacklog] = useState(() => new Set(savedBacklog))
  const [parent, setParent] = useState(savedParent)

  const setReferences = useSetReferences(draft.projectId, draft.id)
  const setBacklogReferences = useSetBacklogReferences(draft.projectId, draft.id)
  const saveParent = useSetParent(draft.projectId, draft.id)

  const isSelected = (item: ReferenceItem) => (item.kind === 'draft' ? drafts : backlog).has(item.id)
  const wasSelected = (item: ReferenceItem) => (item.kind === 'draft' ? savedDrafts : savedBacklog).has(item.id)

  const toggle = (item: ReferenceItem) => {
    const next = new Set(item.kind === 'draft' ? drafts : backlog)
    if (next.has(item.id)) {
      next.delete(item.id)
      if (parent === item.id) setParent(null)
    } else next.add(item.id)
    if (item.kind === 'draft') setDrafts(next)
    else setBacklog(next)
  }
  /** Marks a Backlog Copy as the Parent (adding it as a reference), or unmarks it. */
  const toggleParent = (item: ReferenceItem) => {
    if (!backlog.has(item.id)) setBacklog(new Set(backlog).add(item.id))
    setParent(parent === item.id ? null : item.id)
  }

  const changeOf = (item: ReferenceItem): ReferenceChange | null => {
    if (isSelected(item) && !wasSelected(item)) return 'added'
    if (!isSelected(item) && wasSelected(item)) return 'removed'
    if ((parent === item.id) !== (savedParent === item.id)) return 'parent'
    return null
  }
  const added = items.filter((item) => changeOf(item) === 'added')
  const removed = items.filter((item) => changeOf(item) === 'removed')
  const parentChanged = parent !== savedParent
  const changeCount = added.length + removed.length + (parentChanged ? 1 : 0)

  const discard = () => {
    setDrafts(new Set(savedDrafts))
    setBacklog(new Set(savedBacklog))
    setParent(savedParent)
  }
  const saving = setReferences.isPending || setBacklogReferences.isPending || saveParent.isPending
  /** Backlog References before the Parent: only a referenced Copy can be the Parent. */
  const save = async () => {
    if (!sameSet(drafts, savedDrafts)) await setReferences.mutateAsync([...drafts])
    if (!sameSet(backlog, savedBacklog)) await setBacklogReferences.mutateAsync([...backlog])
    if (parentChanged) await saveParent.mutateAsync(parent)
  }
  const error = setReferences.error ?? setBacklogReferences.error ?? saveParent.error

  return {
    items,
    isSelected,
    toggle,
    parent,
    toggleParent,
    changeOf,
    added,
    removed,
    parentChanged,
    changeCount,
    discard,
    save,
    saving,
    error,
    selectedCount: drafts.size + backlog.size,
  }
}

export type ReferenceSelection = ReturnType<typeof useReferenceSelection>
