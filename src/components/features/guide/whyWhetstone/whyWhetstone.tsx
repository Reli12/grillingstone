// The name, explained once at the top: grilling is the sharpening.

/** The name, explained once at the top: grilling is the sharpening. */
export function WhyWhetstone() {
  return (
    <section
      aria-labelledby="why-whetstone"
      className="mb-12 rounded-lg border border-line bg-sheet p-5 text-[15px] leading-relaxed text-ink-soft"
    >
      <h2 id="why-whetstone" className="font-serif text-xl font-semibold text-ink">
        Why “Whetstone”?
      </h2>
      <p className="mt-2">
        A whetstone doesn’t cut anything itself; you sharpen your own blade against it. Here the blade is your
        requirement and Claude’s questions are the stone. That is what <strong className="text-ink">grilling</strong>{' '}
        means in this tool: every vague word meets resistance until the requirement holds an edge. The edge you end up
        with is yours.
      </p>
    </section>
  )
}
