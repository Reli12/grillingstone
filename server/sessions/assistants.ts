// The Assistants sessions can run on (ADR-0020), and the Settings as sessions and the Settings page see them:
// which Assistant is chosen, its model, and whether each one can run now.
import type { Availability, SettingsView } from '#core/contract/apiTypes.ts'
import { ASSISTANT_NAMES, type AssistantName } from '#core/session/assistantName.ts'

import { getSettings, hasSavedSettings } from '../storage/settings.ts'
import type { Assistant } from './assistant.ts'
import { claudeAssistant } from './claudeAssistant.ts'
import { codexAssistant } from './codexAssistant.ts'
import { AssistantUnavailable } from './sessionError.ts'

export const ASSISTANTS: Record<AssistantName, Assistant> = { claude: claudeAssistant, codex: codexAssistant }

async function availabilityOfAll(): Promise<Record<AssistantName, Availability>> {
  const checks = await Promise.all(ASSISTANT_NAMES.map((name) => ASSISTANTS[name].checkAvailability()))
  return { claude: checks[0], codex: checks[1] }
}

/**
 * The Settings plus each Assistant's availability. Until the human saves Settings, a first run with only Codex
 * ready preselects Codex; otherwise (both, neither, or an existing install) it is Claude.
 */
export async function settingsView(): Promise<SettingsView> {
  const [settings, availability, saved] = await Promise.all([getSettings(), availabilityOfAll(), hasSavedSettings()])
  const onlyCodexReady = !availability.claude.ready && availability.codex.ready
  const assistant = !saved && onlyCodexReady ? 'codex' : settings.assistant
  return { ...settings, assistant, availability }
}

/** The Assistant new sessions run on and its model; refuses, with the fix, when it cannot run now. */
export async function readyAssistant(): Promise<{ assistant: Assistant; model: string }> {
  const settings = await settingsView()
  const availability = settings.availability[settings.assistant]
  if (!availability.ready) throw new AssistantUnavailable(availability.fix)
  return { assistant: ASSISTANTS[settings.assistant], model: settings.models[settings.assistant] }
}
