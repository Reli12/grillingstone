// Which coding agent holds a session's conversation (ADR-0020), kept apart so Settings and Transcripts can name it.
/** The Assistant that runs a session: Claude Code or Codex. */
export type AssistantName = 'claude' | 'codex'
export const ASSISTANT_NAMES: AssistantName[] = ['claude', 'codex']
/** The Assistant used until the human chooses one, and for files written before the choice existed. */
export const DEFAULT_ASSISTANT: AssistantName = 'claude'
/** How the human sees each Assistant named, in the chat, Settings and messages. */
export const ASSISTANT_LABELS: Record<AssistantName, string> = { claude: 'Claude', codex: 'Codex' }
/** How to install each Assistant's CLI and sign in to it: shown by the Guide, the Legal page and Settings' fixes. */
export const ASSISTANT_SETUP: Record<AssistantName, { install: string; signIn: string }> = {
  claude: { install: 'npm install -g @anthropic-ai/claude-code', signIn: 'claude auth login' },
  codex: { install: 'npm install -g @openai/codex', signIn: 'codex login' },
}
