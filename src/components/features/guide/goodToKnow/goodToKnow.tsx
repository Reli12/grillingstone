// How it works: the closing "Good to know" notes (your Assistant's account, permissions, where data lives, legal).
import { Link } from 'react-router'

import { ASSISTANT_LABELS, type AssistantName } from '#core/session/assistantName.ts'

import { InlineCode } from '@/components/atoms/inlineCode/inlineCode'
import { ASSISTANT_ACCOUNTS } from '@/constants/AssistantConstants'
import { useAssistantName } from '@/hooks/settings/useAssistantLabel'
import { routesPaths } from '@/routes/routes'

/** Where each Assistant's own CLI keeps its conversations, so they can be continued. */
const CONVERSATION_FOLDERS: Record<AssistantName, string> = { claude: '~/.claude/projects', codex: '~/.codex' }

export function GoodToKnow() {
  const name = useAssistantName()
  const assistant = ASSISTANT_LABELS[name]
  return (
    <aside className="mt-14 rounded-lg border border-line bg-sheet p-5 text-sm leading-relaxed text-ink-soft">
      <h2 className="font-semibold text-ink">Good to know</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          {assistant} runs as {ASSISTANT_ACCOUNTS[name]}, whichever you signed in with. Pick the Assistant and its model
          in Settings.
        </li>
        <li>
          A session may only read its Project’s folder, edit the Glossary and decision notes, search the web, and submit
          through the tool. It can’t touch anything else.
        </li>
        <li>
          Drafts, Glossaries and Transcripts are stored in the tool’s own <InlineCode>data/</InlineCode> folder. A
          running session survives a page reload. {assistant} keeps its own copy of each grilling conversation (under{' '}
          <InlineCode>{CONVERSATION_FOLDERS[name]}</InlineCode>) so it can be continued.
        </li>
        <li>
          The license, the terms that apply to your Assistant’s account and trademarks are on the{' '}
          <Link to={routesPaths.legal} className="text-claude underline">
            Legal
          </Link>{' '}
          page.
        </li>
      </ul>
    </aside>
  )
}
