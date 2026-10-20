// What `before` holds when the change brings back content the human discarded (set in core/proposal/classify.ts).
import type { Change } from '#core/proposal/proposalTypes.ts'

import { VersionBox } from '@/components/atoms/versionBox/versionBox'
import { Diff } from '@/components/composite/diff/diff'

/** What `before` holds when the change brings back content the human discarded (set in core/proposal/classify.ts). */
const DISCARDED_MARKER = '(Discarded by you)'

/** The text of the change: a Conflict side by side, a Clean Change as a diff, new content in green. */
export function ChangeBody({ change, assistant }: Readonly<{ change: Change; assistant: string }>) {
  const { before, after } = change
  const bringsBack = before === DISCARDED_MARKER
  const hasBefore = before !== undefined && !bringsBack
  if (change.conflict && hasBefore)
    return (
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <VersionBox caption="Yours">
          <p className="font-serif text-[15px] leading-7 whitespace-pre-wrap">{before}</p>
        </VersionBox>
        <VersionBox caption={`${assistant} proposes`}>
          <Diff before={before} after={after} />
        </VersionBox>
      </div>
    )
  return (
    <div className="mt-2 rounded border border-line bg-sheet px-3 py-2">
      {bringsBack && <p className="mb-1 text-[12px] font-medium text-redpencil">Brings back something you discarded</p>}
      {hasBefore ? (
        <Diff before={before} after={after} />
      ) : (
        <p className="font-serif text-[15px] leading-7 whitespace-pre-wrap text-proof">{after}</p>
      )}
    </div>
  )
}
