// The name, explained once at the top: the questions are the heat on the grilling stone.

import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'

/** The name, explained once at the top: the questions are the heat on the grilling stone. */
export function WhyGrillingStone() {
  const assistant = useAssistantLabel()
  return (
    <section
      aria-labelledby="why-grilling-stone"
      className="mb-12 rounded-lg border border-line bg-sheet p-5 text-[15px] leading-relaxed text-ink-soft"
    >
      <h2 id="why-grilling-stone" className="font-serif text-xl font-semibold text-ink">
        Why “Grilling Stone”?
      </h2>
      <p className="mt-2">
        A grilling stone holds the heat, and whatever you put on it gets turned until it’s done all the way through.
        Here your requirement goes on the stone and {assistant}’s questions are the heat. That is what{' '}
        <strong className="text-ink">grilling</strong> means in this tool: every vague word gets turned over until
        nothing raw is left. What comes off the stone is yours to edit.
      </p>
    </section>
  )
}
