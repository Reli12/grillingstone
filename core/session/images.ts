// The Image rules (pure, shared by server and browser): which Images a message may carry, how they are numbered
// across a Transcript, and the content Claude receives for a message with Images.
import type { Reason } from '#core/shared/validation.ts'

export const IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number]

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const satisfies Record<ImageMediaType, string>

/** The file extension an Image of this media type is saved with. */
export const imageExtension = (mediaType: ImageMediaType) => EXTENSIONS[mediaType]

export const MAX_IMAGES_PER_MESSAGE = 5
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
/** Images are shrunk to at most this many pixels on the long edge before they are sent. */
export const MAX_IMAGE_EDGE_PX = 2000
/** About where a session's Images get close to Claude's request size limit; the message box warns from here. */
export const SESSION_IMAGE_WARNING_BYTES = 20 * 1024 * 1024
/** Why a Prototype can't start: its Images, ticked and added, add up to more than the limit above. */
export const PROTOTYPE_IMAGES_TOO_LARGE =
  'The Images add up to more than 20 MB. Untick some, or remove an Image you added.'

/** An Image as the browser sends it: its media type and base64 data. */
export interface ImageUpload {
  mediaType: string
  data: string
}

/** What a Transcript keeps of an Image: the file is found from the Project, the session and the number. */
export interface ImageRef {
  number: number
  mediaType: ImageMediaType
}

export type NumberedImage = ImageUpload & { number: number }

export type ContentBlock =
  { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

const REASON_TYPE: Reason = { code: 'image-type', message: 'Only PNG, JPEG, WebP and GIF Images can be added.' }
const REASON_SIZE: Reason = { code: 'image-size', message: 'An Image can be at most 5 MB after shrinking.' }
const REASON_COUNT: Reason = {
  code: 'image-count',
  message: `A message can have at most ${MAX_IMAGES_PER_MESSAGE} Images.`,
}
const REASON_DATA: Reason = { code: 'image-data', message: 'The Image data is not valid base64.' }

/** Matches only the characters of standard base64 (the `=` padding is taken off first). */
const BASE64_CHARACTERS = /^[A-Za-z0-9+/]*$/
const BASE64_GROUP = 4
const MAX_BASE64_PADDING = 2
const BYTES_PER_BASE64_CHARACTER = 3 / 4
/** The longest base64 text that can still hold an Image of the largest allowed size, plus a little slack. */
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / BYTES_PER_BASE64_CHARACTER) + BASE64_GROUP

export const isImageMediaType = (mediaType: string): mediaType is ImageMediaType =>
  (IMAGE_MEDIA_TYPES as readonly string[]).includes(mediaType)

export const checkImageType = (mediaType: string): Reason | null => (isImageMediaType(mediaType) ? null : REASON_TYPE)

/** How many `=` end the data, counted by walking back from the end (linear, whatever the data holds). */
function paddingLength(data: string): number {
  let end = data.length
  while (end > 0 && data[end - 1] === '=') end--
  return data.length - end
}

/** The decoded size of base64 data, without decoding it. */
export function base64ByteLength(data: string): number {
  const unpaddedLength = data.length - paddingLength(data)
  return Math.floor(unpaddedLength * BYTES_PER_BASE64_CHARACTER)
}

export const checkImageBytes = (bytes: number): Reason | null => (bytes > MAX_IMAGE_BYTES ? REASON_SIZE : null)

/** Whether the data is well-formed base64: right characters, at most two `=` at the end, whole groups of four. */
function isBase64(data: string): boolean {
  const padding = paddingLength(data)
  if (padding > MAX_BASE64_PADDING || data.length % BASE64_GROUP !== 0) return false
  return BASE64_CHARACTERS.test(data.slice(0, data.length - padding))
}

function checkOneImage(image: ImageUpload): Reason[] {
  const typeReason = checkImageType(image.mediaType)
  if (typeReason) return [typeReason]
  // Refused by length before anything reads the text, so a huge body costs nothing to refuse.
  if (image.data.length > MAX_BASE64_LENGTH) return [REASON_SIZE]
  if (!isBase64(image.data)) return [REASON_DATA]
  const sizeReason = checkImageBytes(base64ByteLength(image.data))
  return sizeReason ? [sizeReason] : []
}

/** Whether a message may carry this many Images. */
export const checkImageCount = (count: number): Reason | null => {
  return count > MAX_IMAGES_PER_MESSAGE ? REASON_COUNT : null
}

interface PixelSize {
  width: number
  height: number
}

/** One side scaled down, never below a single pixel. */
const scaledSide = (side: number, scale: number) => Math.max(1, Math.round(side * scale))

/** The size an Image is shrunk to so its long edge is at most 2000 px; one already that small keeps its size. */
export function shrinkToFit(size: PixelSize): PixelSize {
  const longEdge = Math.max(size.width, size.height)
  if (longEdge <= MAX_IMAGE_EDGE_PX) return size
  const scale = MAX_IMAGE_EDGE_PX / longEdge
  return { width: scaledSide(size.width, scale), height: scaledSide(size.height, scale) }
}

/** Why a message may not carry these Images; empty when it may. The same reason is not repeated. */
export function checkMessageImages(images: ImageUpload[]): Reason[] {
  const countReason = checkImageCount(images.length)
  const reasons = countReason ? [countReason] : []
  for (const reason of images.flatMap(checkOneImage))
    if (!reasons.some((known) => known.code === reason.code)) reasons.push(reason)
  return reasons
}

/** An Image that passed every check, with its media type narrowed to the accepted ones. */
export interface ValidImage {
  mediaType: ImageMediaType
  data: string
}

export type ImageCheck = { ok: true; images: ValidImage[] } | { ok: false; reasons: Reason[] }

/** The message's Images with their types narrowed, or why it may not carry them. */
export function parseMessageImages(images: ImageUpload[]): ImageCheck {
  const reasons = checkMessageImages(images)
  if (reasons.length) return { ok: false, reasons }
  const valid = images.flatMap(({ mediaType, data }) => (isImageMediaType(mediaType) ? [{ mediaType, data }] : []))
  return { ok: true, images: valid }
}

/**
 * Numbers a message's Images, continuing after the last number a Transcript recorded. A Continuation starts
 * with the number of the session it continues, so its numbering carries on.
 */
export const numberImages = <T extends ImageUpload>(images: T[], lastNumber: number | undefined) => {
  const first = (lastNumber ?? 0) + 1
  return images.map((image, i) => ({ ...image, number: first + i }))
}

/**
 * The content of a human turn for Claude: each Image after its "Image n:" label, then the text. A message
 * without Images stays the plain text; one without text sends the Images only.
 */
// Claude Code takes a turn's content as a string or as an array of blocks, so the two shapes are deliberate.
// eslint-disable-next-line sonarjs/function-return-type
export function buildMessageContent(text: string, images: NumberedImage[]): string | ContentBlock[] {
  if (!images.length) return text
  const blocks = images.flatMap((image): ContentBlock[] => [
    { type: 'text', text: `Image ${image.number}:` },
    { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
  ])
  return text ? [...blocks, { type: 'text', text }] : blocks
}
