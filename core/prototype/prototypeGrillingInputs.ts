// Prototype Grilling inputs (pure): what a Prototype Grilling Session's folder holds, as data, and what each round adds
// to it (ADR-0024). The first folder is the single-turn builder's, with the Draft optional; a round adds the Images the
// human sent in the conversation, numbered after every number the session has used, and makes the previous round's
// Prototype the starting file again.
import type { PrototypeAssumption } from '#core/prototype/prototypeAssembly.ts'
import { IMAGES_FILE, PROTOTYPE_FILE, START_ASSUMPTIONS_FILE } from '#core/prototype/prototypeFiles.ts'
import {
  buildPrototypeInputs,
  imagesListing,
  type InputFile,
  type InputImage,
  numberedImage,
  type PrototypeInputs,
  type PrototypeInputsRequest,
  startAssumptions,
} from '#core/prototype/prototypeInputs.ts'
import {
  base64ByteLength,
  type NumberedImage,
  numberImages,
  PROTOTYPE_IMAGES_TOO_LARGE,
  SESSION_IMAGE_WARNING_BYTES,
  type ValidImage,
} from '#core/session/images.ts'

export const CONVERSATION_IMAGE_SOURCE = 'Added in the conversation'

export type PrototypeGrillingInputsRequest = PrototypeInputsRequest
export type PrototypeGrillingInputs = PrototypeInputs

export type GrillingInputsResult = { ok: true; inputs: PrototypeGrillingInputs } | { ok: false; reason: string }

const totalBytes = (images: ValidImage[]) => images.reduce((total, image) => total + base64ByteLength(image.data), 0)

/**
 * The first folder: the Draft (if any) from its non-Discarded content, the Glossary, the Images numbered once and
 * the starting Prototype. Refused when the Images the human gave add up to more than 20 MB; Images kept from the
 * starting Prototype are files only and do not count.
 */
export function buildPrototypeGrillingInputs(request: PrototypeGrillingInputsRequest): GrillingInputsResult {
  const { ticked, extra, carried = [] } = request
  if (totalBytes([...ticked, ...extra, ...carried]) > SESSION_IMAGE_WARNING_BYTES)
    return { ok: false, reason: PROTOTYPE_IMAGES_TOO_LARGE }
  return { ok: true, inputs: buildPrototypeInputs(request) }
}

export interface RoundAdditionsRequest {
  /** Every Image file the session has so far, kept ones included. */
  images: InputImage[]
  /** The Images the human sent with this message. */
  sent: ValidImage[]
  /** The Prototype the previous round wrote: Claude's file as submitted, in the session's own numbering. */
  previous: { html: string; assumptions: PrototypeAssumption[] }
}

export interface RoundAdditions {
  /** images.md in full, and the previous Prototype as prototype.html with its assumptions. */
  textFiles: InputFile[]
  /** Every Image of the session after this round. */
  images: InputImage[]
  /** The Image files this round adds. */
  newImages: InputImage[]
  /** The new Images as image blocks for Claude's message. */
  messageImages: NumberedImage[]
}

export type RoundAdditionsResult = { ok: true; additions: RoundAdditions } | { ok: false; reason: string }

/** What one round adds to the session folder; refused when the session's Images would pass 20 MB. */
export function buildRoundAdditions({ images, sent, previous }: RoundAdditionsRequest): RoundAdditionsResult {
  const own = images.filter((image) => !image.kept)
  if (totalBytes([...own, ...sent]) > SESSION_IMAGE_WARNING_BYTES)
    return { ok: false, reason: PROTOTYPE_IMAGES_TOO_LARGE }
  const lastNumber = Math.max(0, ...images.map((image) => image.number))
  const numbered = numberImages(sent, lastNumber)
  const newImages = numbered.map(({ number, mediaType, data }) =>
    numberedImage({ mediaType, data, source: CONVERSATION_IMAGE_SOURCE }, number, false),
  )
  const all = [...images, ...newImages]
  return {
    ok: true,
    additions: {
      textFiles: [
        { path: IMAGES_FILE, content: imagesListing(all) },
        { path: PROTOTYPE_FILE, content: previous.html },
        { path: START_ASSUMPTIONS_FILE, content: startAssumptions(previous.assumptions) },
      ],
      images: all,
      newImages,
      messageImages: numbered,
    },
  }
}
