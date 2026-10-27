// What the New Prototype form holds: the Draft chosen (or none), which of its Images are ticked, the Images attached
// on the form, the starting Prototype chosen, their running total against the 20 MB limit, and the two ways to start:
// grilling (a conversation, opening its session page) or Write now (today's single-turn session). It may open filled
// in with what an earlier session was started with (Try again).
import { useState } from 'react'
import { useNavigate } from 'react-router'

import type { DraftImage } from '#core/prototype/prototypeRecords.ts'
import { PROTOTYPE_IMAGES_TOO_LARGE, SESSION_IMAGE_WARNING_BYTES } from '#core/session/images.ts'

import { useStartPrototypeGrilling } from '@/api/hooks/prototypes/prototypeGrillingHooks'
import { useDraftImages, useProjectPrototypeRows, useStartPrototype } from '@/api/hooks/prototypes/prototypeHooks'
import type { PrototypeSessionInputs } from '@/api/prototypesApi'
import { useImageAttachments } from '@/hooks/chat/useImageAttachments'
import { finishedPrototypes, writingDraftIds } from '@/lib/prototypeRows'
import { routesPaths } from '@/routes/routes'

interface PrototypeStartFormOptions {
  projectId: string
  /** The Draft chosen when the form opens: the one whose tab opened it, or the one a Try again refills. */
  initialDraftId?: string
  /** What a Failed or Stopped session was started with. */
  initial?: PrototypeSessionInputs
  /** A single-turn session has started; its row is on the list. Starting to grill opens the session page instead. */
  onStarted: () => void
}

/** One Image of the Draft, told apart from the others by its session and number. */
const imageKey = ({ sessionId, number }: { sessionId: string; number: number }) => `${sessionId}:${number}`

export function usePrototypeStartForm({
  projectId,
  initialDraftId = '',
  initial,
  onStarted,
}: PrototypeStartFormOptions) {
  const navigate = useNavigate()
  // Which Images the human flipped from where they started, not which are ticked, so Images that load later start
  // right too: ticked, or as the earlier session had them.
  const [flipped, setFlipped] = useState<string[]>([])
  const [draftId, setDraftId] = useState(initialDraftId)
  const [chosenId, setChosenId] = useState(initial?.startingPrototypeId ?? '')
  const attachments = useImageAttachments(`prototype:${initialDraftId || projectId}`, initial?.extraImages)
  const { data: images, error: imagesError } = useDraftImages(projectId, draftId)
  // Any Prototype of the Project can be the starting point, whichever Draft (or none) it belongs to.
  const { data: rows } = useProjectPrototypeRows(projectId)
  const writeNow = useStartPrototype(projectId, draftId)
  const grill = useStartPrototypeGrilling(projectId)

  const draftImages = images ?? []
  const earlier = finishedPrototypes(rows ?? [])

  const startedTicked = (image: DraftImage) =>
    initial ? initial.tickedImages.some((ticked) => imageKey(ticked) === imageKey(image)) : true
  const isTicked = (image: DraftImage) => startedTicked(image) !== flipped.includes(imageKey(image))
  // A starting Prototype deleted since is no longer one to start from.
  const startingPrototypeId = earlier.some((prototype) => prototype.id === chosenId) ? chosenId : ''

  const ticked = draftImages.filter(isTicked)
  const totalBytes = ticked.reduce((sum, image) => sum + image.bytes, attachments.pendingBytes)
  const overLimit = totalBytes > SESSION_IMAGE_WARNING_BYTES
  // With a Draft chosen, its Images are ticked by default: starting before they have loaded would leave them out.
  const loading = (draftId !== '' && images === undefined) || rows === undefined

  const toggle = (image: DraftImage) => {
    const key = imageKey(image)
    setFlipped((keys) => (keys.includes(key) ? keys.filter((other) => other !== key) : [...keys, key]))
  }

  const inputs = () => ({
    tickedImages: ticked.map(({ sessionId, number }) => ({ sessionId, number })),
    extraImages: attachments.batch().uploads,
    ...(startingPrototypeId ? { startingPrototypeId } : {}),
  })

  const startGrilling = () =>
    grill.mutate(
      { ...inputs(), ...(draftId ? { draftId } : {}) },
      { onSuccess: (session) => void navigate(routesPaths.prototypeGrillingSession(projectId, session.id)) },
    )
  const startWriteNow = () => writeNow.mutate(inputs(), { onSuccess: onStarted })

  return {
    attachments,
    draftId,
    setDraftId,
    writing: writingDraftIds(rows ?? []),
    draftImages,
    imagesError,
    earlier,
    isTicked,
    toggle,
    startingPrototypeId,
    setStartingPrototypeId: setChosenId,
    totalBytes,
    reason: overLimit ? PROTOTYPE_IMAGES_TOO_LARGE : undefined,
    loading,
    submitting: grill.isPending || writeNow.isPending,
    startGrilling,
    startWriteNow,
  }
}
