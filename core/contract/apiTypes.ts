// Shapes exchanged over the HTTP API that are not domain types themselves.
import type { AssistantName } from '#core/session/assistantName.ts'
import type { Reason } from '#core/shared/validation.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'

export interface DraftSummary {
  id: string
  projectId: string
  title: string
  requirement: string
  workItemType: WorkItemType
  version: number
  templateName: string
  pendingChanges: number
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  createdAt: string
  drafts: number
}

export interface GlossaryDoc {
  markdown: string
  /** Content hash; a save must name the version it edited (stale saves are refused, ADR-0003). */
  version: string
}

export interface Settings {
  /** Name used in Iteration Log lines (@author). */
  author: string
  /** The Assistant every new session runs on (ADR-0020). */
  assistant: AssistantName
  /** Each Assistant's model ('' = that Assistant's own default), kept apart so switching loses neither. */
  models: Record<AssistantName, string>
  /** 'system' follows the OS appearance. */
  theme: Theme
}

export type Theme = 'system' | 'light' | 'dark'
export const THEMES: Theme[] = ['system', 'light', 'dark']

/** Whether an Assistant can run a session now: installed and signed in, or the fix in plain words. */
export type Availability = { ready: true } | { ready: false; fix: string }

/** The Settings as the API answers them: plus whether each Assistant can run a session now. */
export interface SettingsView extends Settings {
  availability: Record<AssistantName, Availability>
}

export interface ApiError {
  error: string
  reasons?: Reason[]
  /** Names an error the browser handles specially, such as ASSISTANT_UNAVAILABLE. */
  code?: string
}

/** A session was refused because the Assistant in Settings is not installed or not signed in. */
export const ASSISTANT_UNAVAILABLE = 'assistant-unavailable'

export interface Project {
  id: string
  name: string
  createdAt: string
}
