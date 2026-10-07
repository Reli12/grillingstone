// The pending Proposal changes for one Section or Entry, each with accept and reject.
import type { Change } from '#core/proposal/proposalTypes.ts'

import { ChangeCard } from '@/components/features/draft/proposal/changeCard/changeCard'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'

interface ChangesProps {
  changes: Change[]
}

export function Changes({ changes }: Readonly<ChangesProps>) {
  const { decide, busy } = useDraftEditor()
  if (!changes.length) return null
  return (
    <div className="mt-2 space-y-2">
      {changes.map((change) => (
        <ChangeCard key={change.id} change={change} busy={busy} onDecide={(accept) => decide(change.id, accept)} />
      ))}
    </div>
  )
}
