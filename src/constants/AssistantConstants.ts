// How the Settings page describes each Assistant: which account it runs on, and its model field.
import type { AssistantName } from '#core/session/assistantName.ts'

/** The tool behind each Assistant and the accounts it signs in with. */
export const ASSISTANT_ACCOUNTS: Record<AssistantName, string> = {
  claude: 'Claude Code, on your Claude subscription or Anthropic API key',
  codex: 'Codex CLI, on your ChatGPT plan or OpenAI API key',
}

export const MODEL_PLACEHOLDERS: Record<AssistantName, string> = {
  claude: 'Claude Code default',
  codex: 'Codex default',
}

export const MODEL_HINTS: Record<AssistantName, string> = {
  claude: 'Leave empty for Claude Code’s default. Aliases like opus or sonnet work.',
  codex: 'Leave empty for Codex’s default.',
}
