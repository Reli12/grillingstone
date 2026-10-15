// How it works: the closing "Good to know" notes (your Claude account, permissions, where data lives, legal).
import { Link } from 'react-router'

import { InlineCode } from '@/components/atoms/inlineCode/inlineCode'
import { routesPaths } from '@/routes/routes'

export function GoodToKnow() {
  return (
    <aside className="mt-14 rounded-lg border border-line bg-sheet p-5 text-sm leading-relaxed text-ink-soft">
      <h2 className="font-semibold text-ink">Good to know</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          Claude runs as Claude Code on your own Claude account: a Claude subscription or an Anthropic API key,
          whichever you signed in with. Pick the model in Settings.
        </li>
        <li>
          A session may only read its Project’s folder, edit the Glossary and decision notes, search the web, and submit
          through the tool. It can’t touch anything else.
        </li>
        <li>
          Drafts, Glossaries and Transcripts are stored in the tool’s own <InlineCode>data/</InlineCode> folder. A
          running session survives a page reload. Claude Code keeps its own copy of each grilling conversation (under{' '}
          <InlineCode>~/.claude/projects</InlineCode>) so it can be continued.
        </li>
        <li>
          The license, the terms that apply to your Claude account and trademarks are on the{' '}
          <Link to={routesPaths.legal} className="text-claude underline">
            Legal
          </Link>{' '}
          page.
        </li>
      </ul>
    </aside>
  )
}
