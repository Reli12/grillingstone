// The Assistant's name as the UI shows it outside a session: the one chosen in Settings (ADR-0020).
// Inside a session the chat names the Assistant that holds it, from the Transcript, instead.
import { ASSISTANT_LABELS, DEFAULT_ASSISTANT } from '#core/session/assistantName.ts'

import { useChosenAssistant } from '@/api/hooks/projects/projectHooks'

/** "Claude" or "Codex", from Settings; the default Assistant until they load. */
export function useAssistantLabel() {
  const { data: assistant } = useChosenAssistant()
  return ASSISTANT_LABELS[assistant ?? DEFAULT_ASSISTANT]
}
