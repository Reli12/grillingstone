// Types shared by the Draft page's layouts and panels.
import { type ReactNode } from 'react'

import type { Draft } from '#core/draft/draftTypes.ts'
import { type SessionSummary, type Transcript } from '#core/session/sessionTypes.ts'
import type { Template } from '#core/template/templateTypes.ts'

import type { DraftPageUi } from '@/hooks/draft/useDraftPageUi'

export type Side = 'chat' | 'glossary'

export type MobileView = 'chat' | 'draft'

/** What deciding whether a session can be continued needs to know about it. */
export type Continuable = Pick<Transcript, 'status' | 'conversationId' | 'assistant'>

export interface LayoutProps {
  projectId: string
  projectName?: string
  draft: Draft
  live?: SessionSummary
  ui: DraftPageUi
  chat: ReactNode
  dialogs: ReactNode
}

export interface DraftWorkspaceLayoutProps extends LayoutProps {
  /** The newer Template version on offer, if the Draft may upgrade. */
  upgradeTo?: Template
  busy: boolean
  onAcceptClean: () => void
}
