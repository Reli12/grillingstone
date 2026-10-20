// Proposed new Sections, shown after the existing ones until they are decided.
import { ChangeCard } from '@/components/features/draft/proposal/changeCard/changeCard'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'

/** Proposed new Sections, shown after the existing ones until they are decided. */
export function NewSectionChanges() {
  const { pending, decide, busy, proposalAssistant } = useDraftEditor()
  const newSections = pending.filter((change) => change.kind === 'addSection')
  if (newSections.length === 0) return null
  return (
    <div className="mt-8 space-y-3 pl-8">
      {newSections.map((change) => (
        <ChangeCard
          key={change.id}
          change={change}
          assistant={proposalAssistant}
          busy={busy}
          onDecide={(accept) => decide(change.id, accept)}
        />
      ))}
    </div>
  )
}
