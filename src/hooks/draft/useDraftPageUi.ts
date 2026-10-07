// The page's own UI state: which dialog, tab and side panel is showing, and what the chat continues.
import { useState } from 'react'

import { type Transcript } from '#core/session/sessionTypes.ts'

import { type StartIntent } from '@/components/features/draft/dialogs/startSessionDialog/startSessionDialog'
import type { MobileView, Side } from '@/types/draftPage'

/** The page's own UI state: which dialog, tab and side panel is showing, and what the chat continues. */
export function useDraftPageUi() {
  const [intent, setIntent] = useState<StartIntent | null>(null)
  const [side, setSide] = useState<Side>('chat')
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [refsOpen, setRefsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('draft')
  /** The ended session the next message continues, instead of starting a new one. */
  const [continueFrom, setContinueFrom] = useState<Transcript | null>(null)
  /** A session just started: bring its chat into view, on small screens too. */
  const showChat = () => {
    setSide('chat')
    setMobileView('chat')
  }
  return {
    intent,
    setIntent,
    side,
    setSide,
    glossaryOpen,
    setGlossaryOpen,
    copyOpen,
    setCopyOpen,
    refsOpen,
    setRefsOpen,
    deleteOpen,
    setDeleteOpen,
    mobileView,
    setMobileView,
    continueFrom,
    setContinueFrom,
    showChat,
  }
}

export type DraftPageUi = ReturnType<typeof useDraftPageUi>
