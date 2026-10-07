// How it works: the closing "Good to know" notes (subscription, permissions, where data lives).

export function GoodToKnow() {
  return (
    <aside className="mt-14 rounded-lg border border-line bg-sheet p-5 text-sm leading-relaxed text-ink-soft">
      <h2 className="font-semibold text-ink">Good to know</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>Claude runs as Claude Code on your own subscription — no API key. Pick the model in Settings.</li>
        <li>
          A session may only read its Project’s folder, edit the Glossary and decision notes, search the web, and submit
          through the tool. It can’t touch anything else.
        </li>
        <li>
          Drafts, Glossaries and Transcripts are stored in the tool’s own{' '}
          <code className="rounded bg-fog px-1">data/</code> folder. A running session survives a page reload. Claude
          Code keeps its own copy of each grilling conversation (under{' '}
          <code className="rounded bg-fog px-1">~/.claude/projects</code>) so it can be continued.
        </li>
      </ul>
    </aside>
  )
}
