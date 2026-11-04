// What the Prototype start form holds: which of the Draft's Images are ticked, the Images attached on the form,
// the starting Prototype chosen, their running total against the 20 MB limit, and Submit. It may open filled in
// with what an earlier session was started with (Try again).
import { useState } from 'react'

import type { DraftImage, Prototype } from '#core/prototype/prototypeRecords.ts'
import { PROTOTYPE_IMAGES_TOO_LARGE, SESSION_IMAGE_WARNING_BYTES } from '#core/session/images.ts'

import { useStartPrototype } from '@/api/hooks/prototypes/prototypeHooks'
import type { PrototypeSessionInputs } from '@/api/prototypesApi'
import { useImageAttachments } from '@/hooks/chat/useImageAttachments'

interface PrototypeStartFormOptions {
  projectId: string
  draftId: string
  /** Every Image of the Draft's Grilling Sessions; each starts ticked unless `initial` says otherwise. */
  images: DraftImage[]
  /** The Draft's finished Prototypes: only one of these can be the starting point. */
  earlier: Prototype[]
  /** What a Failed or Stopped session was started with. */
  initial?: PrototypeSessionInputs
  onStarted: () => void
}

/** One Image of the Draft, told apart from the others by its session and number. */
const imageKey = ({ sessionId, number }: { sessionId: string; number: number }) => `${sessionId}:${number}`

export function usePrototypeStartForm({
  projectId,
  draftId,
  images,
  earlier,
  initial,
  onStarted,
}: PrototypeStartFormOptions) {
  // Which Images the human flipped from where they started, not which are ticked, so Images that load later start
  // right too: ticked, or as the earlier session had them.
  const [flipped, setFlipped] = useState<string[]>([])
  const [chosenId, setChosenId] = useState(initial?.startingPrototypeId ?? '')
  const attachments = useImageAttachments(`prototype:${draftId}`, initial?.extraImages)
  const start = useStartPrototype(projectId, draftId)

  const startedTicked = (image: DraftImage) =>
    initial ? initial.tickedImages.some((ticked) => imageKey(ticked) === imageKey(image)) : true
  const isTicked = (image: DraftImage) => startedTicked(image) !== flipped.includes(imageKey(image))
  // A starting Prototype deleted since is no longer one to start from.
  const startingPrototypeId = earlier.some((prototype) => prototype.id === chosenId) ? chosenId : ''

  const ticked = images.filter(isTicked)
  const totalBytes = ticked.reduce((sum, image) => sum + image.bytes, attachments.pendingBytes)
  const overLimit = totalBytes > SESSION_IMAGE_WARNING_BYTES

  const toggle = (image: DraftImage) => {
    const key = imageKey(image)
    setFlipped((keys) => (keys.includes(key) ? keys.filter((other) => other !== key) : [...keys, key]))
  }

  const submit = () => {
    const { uploads } = attachments.batch()
    start.mutate(
      {
        tickedImages: ticked.map(({ sessionId, number }) => ({ sessionId, number })),
        extraImages: uploads,
        ...(startingPrototypeId ? { startingPrototypeId } : {}),
      },
      { onSuccess: onStarted },
    )
  }

  return {
    attachments,
    isTicked,
    toggle,
    startingPrototypeId,
    setStartingPrototypeId: setChosenId,
    totalBytes,
    reason: overLimit ? PROTOTYPE_IMAGES_TOO_LARGE : undefined,
    submitting: start.isPending,
    submit,
  }
}
