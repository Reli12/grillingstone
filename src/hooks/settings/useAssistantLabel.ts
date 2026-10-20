// The Assistant as the UI names it outside a session: the one chosen in Settings (ADR-0020).
// Inside a session the chat names the Assistant that holds it, from the Transcript, instead.
import { ASSISTANT_LABELS, type AssistantName, DEFAULT_ASSISTANT } from '#core/session/assistantName.ts'

import { useChosenAssistant } from '@/api/hooks/projects/projectHooks'

/** "claude" or "codex", from Settings; the default Assistant until they load. */
export function useAssistantName(): AssistantName {
  const { data: assistant } = useChosenAssistant()
  return assistant ?? DEFAULT_ASSISTANT
}

/** "Claude" or "Codex", from Settings; the default Assistant until they load. */
export function useAssistantLabel() {
  return ASSISTANT_LABELS[useAssistantName()]
}
