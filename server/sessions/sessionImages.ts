// The Images of one human turn, as the Supervisor handles them: checked and numbered first (nothing changes yet),
// then saved to disk, then recorded in the Transcript together with the message that lists them.
import {
  type ImageRef,
  type ImageUpload,
  numberImages,
  parseMessageImages,
  type ValidImage,
} from '#core/session/images.ts'
import type { Transcript } from '#core/session/sessionTypes.ts'

import { deleteSessionImages, saveImage } from '../storage/images.ts'
import { SessionError } from './sessionError.ts'
import { type AnyTranscript, isGrillingTranscript } from './sessionScope.ts'

export type NumberedValidImage = ValidImage & { number: number }

/** Every Image the human's messages in a Grilling Session carry, in the order they were sent. */
export const humanImageRefs = (transcript: Transcript): ImageRef[] =>
  transcript.messages.flatMap((message) => (message.role === 'human' ? (message.images ?? []) : []))

/** Only Grilling Sessions take Images; a Template Session has no Project to keep them in. */
function grillingTranscript(transcript: AnyTranscript): Transcript {
  if (transcript.kind === 'template') throw new SessionError('Template Sessions do not take Images.')
  if (!isGrillingTranscript(transcript)) throw new SessionError('Prototype Sessions take their Images at the start.')
  return transcript
}

/** Checks the Images and numbers them on from the Transcript's last one. Saves and records nothing. */
export function numberUploads(transcript: AnyTranscript, uploads: ImageUpload[]): NumberedValidImage[] {
  if (!uploads.length) return []
  const grilling = grillingTranscript(transcript)
  const checked = parseMessageImages(uploads)
  if (!checked.ok) throw new SessionError(checked.reasons.map((reason) => reason.message).join(' '))
  return numberImages(checked.images, grilling.lastImageNumber)
}

/** Saves the Images to disk, in the Project's folder, and returns what the Transcript lists for them. */
export async function saveNumbered(transcript: AnyTranscript, images: NumberedValidImage[]): Promise<ImageRef[]> {
  if (!images.length) return []
  const { projectId, id: sessionId } = grillingTranscript(transcript)
  for (const { number, mediaType, data } of images) await saveImage({ projectId, sessionId, number, mediaType, data })
  return images.map(({ number, mediaType }) => ({ number, mediaType }))
}

/** Notes the last Image number in the Transcript; called in the same step as pushing the message that lists them. */
export function recordLastImage(transcript: AnyTranscript, refs: ImageRef[]) {
  const last = refs.at(-1)
  if (last && isGrillingTranscript(transcript)) transcript.lastImageNumber = last.number
}

/** Removes the Images of a session that never started. */
export async function discardSessionImages(transcript: AnyTranscript) {
  if (!isGrillingTranscript(transcript)) return
  await deleteSessionImages(transcript.projectId, transcript.id).catch(() => {
    // Best effort: the session failed to start anyway, and a leftover folder is harmless.
  })
}
