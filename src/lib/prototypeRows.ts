// Small questions about the rows of a Prototypes list, asked by the Draft's tab and the Project's tab alike.
import type { Prototype, PrototypeRow } from '#core/prototype/prototypeRecords.ts'

/** A row's id: its Prototype's, or its session's. */
export const rowId = (row: PrototypeRow) => (row.kind === 'finished' ? row.prototype.id : row.session.id)

/** The Draft a row belongs to; none for a Prototype or a Prototype Grilling Session of no Draft. */
export function rowDraftId(row: PrototypeRow): string | undefined {
  switch (row.kind) {
    case 'finished':
      return row.prototype.draft?.draftId
    case 'runningGrilling':
    case 'endedGrilling':
      return row.session.draft?.draftId
    case 'running':
    case 'failed':
    case 'stopped':
      return row.session.draftId
    default: {
      const _exhaustive: never = row
      return _exhaustive
    }
  }
}

/** The Drafts a Prototype is being written for: each is asked once, however long the list. */
export const writingDraftIds = (rows: PrototypeRow[]): ReadonlySet<string> =>
  new Set(
    rows.flatMap((row) => {
      const draftId = row.kind === 'running' || row.kind === 'runningGrilling' ? rowDraftId(row) : undefined
      return draftId === undefined ? [] : [draftId]
    }),
  )

/** Whether a Prototype is being written for the Draft by a session of either kind: one at a time. */
export const isWritingFor = (rows: PrototypeRow[], draftId: string) => writingDraftIds(rows).has(draftId)

/** The finished Prototypes among the rows, in the same order. */
export const finishedPrototypes = (rows: PrototypeRow[]): Prototype[] =>
  rows.flatMap((row) => (row.kind === 'finished' ? [row.prototype] : []))

/** The Prototypes a Prototype Grilling Session wrote, oldest round first; one deleted since is not among them. */
export const sessionPrototypes = (rows: PrototypeRow[], prototypeIds: readonly string[]): Prototype[] => {
  const written = finishedPrototypes(rows)
  return prototypeIds.flatMap((id) => written.filter((prototype) => prototype.id === id))
}
