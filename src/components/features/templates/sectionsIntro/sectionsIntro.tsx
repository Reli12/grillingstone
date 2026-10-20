// Template editor: the Sections heading and the rules every Section is written under.
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'

/** The Sections heading, saying the Assistant writes every Section in this order. */
export function SectionsIntro() {
  const assistant = useAssistantLabel()
  return (
    <>
      <h2 className="font-serif text-xl font-semibold">Sections</h2>
      <p className="mt-1 text-sm text-ink-soft">
        In this order {assistant} must write them — every one, with “N/A — reason” when empty. Locked Sections can never
        be discarded or left empty.
      </p>
    </>
  )
}
