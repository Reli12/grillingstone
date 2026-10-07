// Seen running in this view, then saved: continue straight into the editor.
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'

import { type SessionStatus } from '#core/session/sessionTypes.ts'

import { routesPaths } from '@/routes/routes'

/** Seen running in this view, then saved: continue straight into the editor. */
export function useOpenEditorOnceSaved(live: boolean, status?: SessionStatus, templateId?: string) {
  const navigate = useNavigate()
  const wasLive = useRef(false)
  useEffect(() => {
    if (live) wasLive.current = true
    else if (wasLive.current && status === 'finished' && templateId) void navigate(routesPaths.template(templateId))
  }, [live, status, templateId, navigate])
}
