// Prototype inputs (pure): what a Prototype Session's folder holds, as data, and which Images Claude is sent.
// Only the Draft's live content goes in (never a pending Proposal, never anything Discarded), plus the Glossary,
// the numbered Images and, when starting from an earlier Prototype, its source and assumptions (ADR-0023).
import type { Draft } from '#core/draft/draftTypes.ts'
import type { PrototypeAssumption } from '#core/prototype/prototypeAssembly.ts'
import {
  DRAFT_FILE,
  GLOSSARY_FILE,
  IMAGES_FILE,
  IMAGES_FOLDER,
  PROTOTYPE_FILE,
  START_ASSUMPTIONS_FILE,
} from '#core/prototype/prototypeFiles.ts'
import { liveDraftMarkdown } from '#core/publish/draftMarkdown.ts'
import { imageExtension, type ImageMediaType, type NumberedImage, type ValidImage } from '#core/session/images.ts'

export const EXTRA_IMAGE_SOURCE = 'Added on the start form'
const KEPT_NOTE = 'kept from the starting Prototype'
const KEPT_FILE_NOTE = ' It is a file only: you are not shown it as an image block; Read it if you need it.'

/** An Image the human ticked, with where it came from (e.g. "Grilling Session of 2026-10-01, Image 2"). */
export interface PrototypeImage extends ValidImage {
  source: string
}

/** An Image the starting Prototype showed, by the number its own source uses. */
export interface StartingImage extends PrototypeImage {
  number: number
}

/** An earlier Prototype of the same Draft, as the new session starts from it. */
export interface StartingPrototype {
  /** Claude's source of that Prototype, with `images/N` in its own numbering. */
  html: string
  assumptions: PrototypeAssumption[]
  images: StartingImage[]
}

export interface PrototypeInputsRequest {
  /** Absent for a Prototype Grilling Session that starts from no Draft: then there is no draft.md. */
  draft?: Draft
  /** The Project's CONTEXT.md ('' when it does not exist). */
  glossary: string
  /** Ticked Images, already in the order to number them: oldest Grilling Session first. */
  ticked: PrototypeImage[]
  /** Images added on the start form; numbered after the ticked ones. */
  extra: ValidImage[]
  /**
   * A Continuation: the Images the earlier session added itself (start form and conversation), at the numbers they
   * had there, so that what Claude remembers as "Image 7" is still Image 7.
   */
  carried?: Array<PrototypeImage & { number: number }>
  starting?: StartingPrototype
}

export interface InputFile {
  /** Relative to the session folder. */
  path: string
  content: string
}

/** An Image of the session: a file in `images/`, and a number Claude and the page refer to it by. */
export interface InputImage extends PrototypeImage {
  number: number
  path: string
  /** From the starting Prototype only: a file, not sent to Claude as an image block. */
  kept: boolean
}

export interface PrototypeInputs {
  textFiles: InputFile[]
  /** Every Image file of the session, ticked, extra and kept, by number. */
  images: InputImage[]
  /** The Images that go into Claude's first message as image blocks: ticked and extra, not kept. */
  messageImages: NumberedImage[]
}

// `images/N` as written in a Prototype's source; N is captured.
const IMAGE_PATH_IN_SOURCE = /\bimages\/(\d+)(?!\w)/g

const imagePath = (number: number, type: ImageMediaType) => `${IMAGES_FOLDER}/${number}.${imageExtension(type)}`

const sameImage = (first: ValidImage, second: ValidImage) =>
  first.mediaType === second.mediaType && first.data === second.data

export function numberedImage(image: PrototypeImage, number: number, kept: boolean): InputImage {
  return { ...image, number, path: imagePath(number, image.mediaType), kept }
}

/** Ticked first, then start-form Images: the numbers of this session before anything kept. */
function sessionImages({ ticked, extra, carried = [] }: PrototypeInputsRequest): InputImage[] {
  const extras = extra.map((image) => ({ ...image, source: EXTRA_IMAGE_SOURCE }))
  const own = [...ticked, ...extras].map((image, i) => numberedImage(image, i + 1, false))
  const kept = [...carried]
    .sort((first, second) => first.number - second.number)
    .map((image) => numberedImage(image, image.number, false))
  return [...own, ...kept]
}

/**
 * Which number each of the starting Prototype's Images has in this session: the number of an identical Image the
 * session already has, or a new number after the session's own for one it lacks (those are returned as kept).
 */
function startingNumbers(session: InputImage[], starting: StartingPrototype) {
  const renumbered = new Map<number, number>()
  const kept: InputImage[] = []
  let next = Math.max(0, ...session.map((image) => image.number)) + 1
  for (const image of [...starting.images].sort((first, second) => first.number - second.number)) {
    const same = session.find((candidate) => sameImage(candidate, image))
    if (same) {
      renumbered.set(image.number, same.number)
      continue
    }
    renumbered.set(image.number, next)
    // An Image kept through several Prototypes is noted once, with where it first came from.
    const source = image.source.startsWith(KEPT_NOTE) ? image.source : `${KEPT_NOTE} (${image.source})`
    kept.push(numberedImage({ ...image, source }, next, true))
    next++
  }
  return { renumbered, kept }
}

/** The starting source with its `images/N` references in this session's numbering, all at once. */
const renumberReferences = (html: string, renumbered: Map<number, number>) =>
  html.replace(IMAGE_PATH_IN_SOURCE, (whole, old: string) => {
    const number = renumbered.get(Number(old))
    return number === undefined ? whole : `${IMAGES_FOLDER}/${number}`
  })

export function imagesListing(images: InputImage[]): string {
  if (!images.length) return '# Images\n\nNo Images in this session.\n'
  const lines = images.map((image) => {
    const note = image.kept ? KEPT_FILE_NOTE : ''
    return `- Image ${image.number} (${image.path}): ${image.source}.${note}`
  })
  return `# Images\n\nRefer to an Image in the page as images/N, with the number and no file extension.\n\n${lines.join('\n')}\n`
}

export function startAssumptions(assumptions: PrototypeAssumption[]): string {
  const lines = assumptions.map((assumption) => `- ${assumption.choice}: ${assumption.why}`)
  return `# Assumptions of the starting Prototype\n\n${lines.join('\n')}\n`
}

export function buildPrototypeInputs(request: PrototypeInputsRequest): PrototypeInputs {
  const { draft, glossary, starting } = request
  const own = sessionImages(request)
  const carried = starting ? startingNumbers(own, starting) : undefined
  const images = [...own, ...(carried?.kept ?? [])]

  const textFiles: InputFile[] = [
    ...(draft ? [{ path: DRAFT_FILE, content: liveDraftMarkdown(draft) }] : []),
    { path: GLOSSARY_FILE, content: glossary },
    { path: IMAGES_FILE, content: imagesListing(images) },
  ]
  if (starting && carried) {
    textFiles.push(
      { path: PROTOTYPE_FILE, content: renumberReferences(starting.html, carried.renumbered) },
      { path: START_ASSUMPTIONS_FILE, content: startAssumptions(starting.assumptions) },
    )
  }
  const messageImages = own.map(({ number, mediaType, data }) => ({ number, mediaType, data }))
  return { textFiles, images, messageImages }
}
