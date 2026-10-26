// Small questions about the rows of a Prototypes list, asked by the Draft's tab and the Project's tab alike.
import type { Prototype, PrototypeRow } from '#core/prototype/prototypeRecords.ts'

/** A row's id: its Prototype's, or its session's. */
export const rowId = (row: PrototypeRow) => (row.kind === 'finished' ? row.prototype.id : row.session.id)

/** The Draft a row belongs to. */
export const rowDraftId = (row: PrototypeRow) => (row.kind === 'finished' ? row.prototype.draftId : row.session.draftId)

/** Whether a Prototype is being written for the Draft: one at a time, so it can't be started again meanwhile. */
export const isWritingFor = (rows: PrototypeRow[], draftId: string) =>
  rows.some((row) => row.kind === 'running' && row.session.draftId === draftId)

/** The Drafts a Prototype is being written for: each is asked once, however long the list. */
export const writingDraftIds = (rows: PrototypeRow[]): ReadonlySet<string> =>
  new Set(rows.filter((row) => row.kind === 'running').map(rowDraftId))

/** The finished Prototypes among the rows, in the same order. */
export const finishedPrototypes = (rows: PrototypeRow[]): Prototype[] =>
  rows.flatMap((row) => (row.kind === 'finished' ? [row.prototype] : []))
