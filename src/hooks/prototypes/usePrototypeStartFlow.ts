// Which Prototype start form is open, for which Draft and with what in it: a blank one for New Prototype, or one
// refilled from a Failed or Stopped session for Try again. Shared by the Draft's tab and the Project's tab.
import { useRef, useState } from 'react'

import type { PrototypeSessionSummary } from '#core/session/sessionTypes.ts'

import { useLoadSessionInputs } from '@/api/hooks/prototypes/prototypeHooks'
import type { PrototypeSessionInputs } from '@/api/prototypesApi'

/** An open start form. A new `key` mounts a fresh form, so one never carries its state into the next. */
export interface OpenStartForm {
  key: number
  draftId: string
  initial?: PrototypeSessionInputs
}

export function usePrototypeStartFlow(projectId: string) {
  const [open, setOpen] = useState<OpenStartForm | null>(null)
  const forms = useRef(0)
  const loadInputs = useLoadSessionInputs(projectId)

  const show = (draftId: string, initial?: PrototypeSessionInputs) => {
    forms.current += 1
    setOpen({ key: forms.current, draftId, ...(initial ? { initial } : {}) })
  }

  return {
    open,
    openNew: (draftId: string) => show(draftId),
    /** Reopens the form with the session's Images and starting Prototype, once the backend has given them; a
     *  failure is toasted by the app's mutation cache, and no form opens. */
    tryAgain: (session: PrototypeSessionSummary) =>
      loadInputs.mutate(session.id, { onSuccess: (inputs) => show(session.draftId, inputs) }),
    close: () => setOpen(null),
  }
}
