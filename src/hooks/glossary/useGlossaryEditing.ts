// Editing the Glossary safely: every edit saves against the Glossary as it was when the edit opened, so a
// term the Assistant or another tab added meanwhile is never silently dropped or overwritten. A refused save keeps
// the human's text, takes the latest Glossary as the new starting point, and finds the edited term by name.
import { useState } from 'react'

import type { GlossaryDoc } from '#core/contract/apiTypes.ts'
import { addTerm, findTerm, type GlossaryTerm, removeTerm, updateTerm } from '#core/glossary/glossary.ts'

import { useGlossary, useProject } from '@/api/hooks/projects/projectHooks'
import { useCheckedGlossarySave } from '@/hooks/glossary/useCheckedGlossarySave'
import type { TermEdit } from '@/types/glossary'

const EMPTY_TERM: GlossaryTerm = { term: '', definition: '', avoid: '' }

/** An open edit: the Glossary it started from, the term or the raw markdown being edited, and how the last save
 *  went wrong: refused because the Glossary changed meanwhile (`stale`), or failed for another `failure`. */
interface OpenEdit {
  base: GlossaryDoc
  edit: TermEdit | null
  raw: string | null
  stale: boolean
  failure: string | null
}

/** Where a named term sits in this markdown, or null when it is gone. */
function indexOf(markdown: string, name: string): number | null {
  const index = findTerm(markdown, name)
  return index < 0 ? null : index
}

/** The open term, moved onto the latest Glossary; a term renamed or removed meanwhile is saved as a new one. */
const movedOnto = (latest: GlossaryDoc, edit: TermEdit | null): TermEdit | null =>
  edit?.index == null ? edit : { ...edit, index: indexOf(latest.markdown, edit.name) }

/** Where the open term sits in the Glossary shown now, which a live update may have moved; null when it is gone. */
function shownIndex(doc: GlossaryDoc | undefined, opened: OpenEdit | null): number | null {
  const edit = opened?.edit
  if (!doc || edit?.index == null) return null
  return opened?.base.version === doc.version ? edit.index : indexOf(doc.markdown, edit.name)
}

/** The Glossary the edit started from, with the open term saved as `term` (added when it is new). */
const withTerm = ({ base, edit }: OpenEdit, term: GlossaryTerm, projectName?: string) =>
  edit?.index == null ? addTerm(base.markdown, term, projectName) : updateTerm(base.markdown, edit.index, term)

/** The Glossary the edit started from without the open term; null for a term not saved yet. */
const withoutTerm = ({ base, edit }: OpenEdit) => (edit?.index == null ? null : removeTerm(base.markdown, edit.index))

/** After a refused save: start over from the latest Glossary, keeping the typed text and the open term. */
const refusedOnto = (latest: GlossaryDoc) => (current: OpenEdit | null) =>
  current && { ...current, base: latest, edit: movedOnto(latest, current.edit), stale: true, failure: null }

/** After a save that failed for another reason: keep everything and say why. */
const failedWith = (failure: string) => (current: OpenEdit | null) => current && { ...current, stale: false, failure }

/** The open edit, and the moves between its states: opening a term, a new term or the raw markdown, editing the
 *  raw text, closing, and a refused or failed save. */
function useOpenEdit(doc: GlossaryDoc | undefined) {
  const [opened, setOpened] = useState<OpenEdit | null>(null)
  const open = (edit: TermEdit | null, raw: string | null) => {
    if (doc) setOpened({ base: doc, edit, raw, stale: false, failure: null })
  }
  return {
    opened,
    startTerm: (index: number, term: GlossaryTerm) => open({ index, name: term.term, term }, null),
    startNew: () => open({ index: null, name: '', term: EMPTY_TERM }, null),
    startRaw: () => open(null, doc?.markdown ?? ''),
    close: () => setOpened(null),
    setRaw: (raw: string) => setOpened((current) => current && { ...current, raw }),
    refused: (latest: GlossaryDoc) => setOpened(refusedOnto(latest)),
    failed: (failure: string) => setOpened(failedWith(failure)),
  }
}

interface Options {
  /** Called with a term's name once it is saved, so the list can keep showing it. */
  onTermSaved?: (name: string) => void
}

export function useGlossaryEditing(projectId: string, { onTermSaved }: Options = {}) {
  const { data: doc } = useGlossary(projectId)
  const { data: project } = useProject(projectId)
  const { saveChecked, saving } = useCheckedGlossarySave(projectId)
  const { opened, close, refused, failed, ...actions } = useOpenEdit(doc)

  const saveMarkdown = (markdown: string, savedTerm?: string) => {
    if (!opened) return
    saveChecked(opened.base, markdown, {
      onSaved: () => {
        if (savedTerm !== undefined) onTermSaved?.(savedTerm)
        close()
      },
      onRefused: refused,
      onFailed: failed,
    })
  }

  return {
    doc,
    edit: opened?.edit ?? null,
    editingIndex: shownIndex(doc, opened),
    raw: opened?.raw ?? null,
    stale: opened?.stale ?? false,
    failure: opened?.failure ?? null,
    saving,
    ...actions,
    cancel: close,
    saveTerm: (term: GlossaryTerm) => {
      if (opened?.edit) saveMarkdown(withTerm(opened, term, project?.name), term.term.trim())
    },
    removeTerm: () => {
      const markdown = opened && withoutTerm(opened)
      if (markdown) saveMarkdown(markdown)
      else close()
    },
    saveRaw: () => {
      if (opened?.raw != null) saveMarkdown(opened.raw)
    },
  }
}
