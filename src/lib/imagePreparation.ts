// Turns a pasted, dropped or picked file into a ready Image (type, base64 data, size) or a reason it was refused.
// Needs a browser: it decodes and re-encodes through a canvas, so component tests stub it.
import {
  checkImageBytes,
  checkImageType,
  type ImageMediaType,
  isImageMediaType,
  shrinkToFit,
} from '#core/session/images.ts'

export interface PreparedImage {
  mediaType: ImageMediaType
  /** Base64, without a data: prefix. */
  data: string
  /** Bytes after shrinking. */
  size: number
}

export type Preparation = { ok: true; image: PreparedImage } | { ok: false; reason: string }

/** Quality for the lossy formats when an Image is re-encoded after shrinking. */
const REENCODE_QUALITY = 0.92
/** A canvas can't write GIF, so the first frame of a GIF is kept as a PNG. */
const GIF = 'image/gif'
const PNG = 'image/png'
const DATA_URL_PREFIX = /^data:[^,]*,/ // the "data:image/png;base64," start of a data URL

function readAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      resolve(dataUrl.replace(DATA_URL_PREFIX, ''))
    }
    reader.onerror = () => reject(new Error('The file could not be read.'))
    reader.readAsDataURL(blob)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, mediaType: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mediaType, REENCODE_QUALITY))
}

/** Draws the Image (the first frame of a GIF) at the given size and encodes it in the same format where it can. */
async function redraw(bitmap: ImageBitmap, size: { width: number; height: number }, mediaType: string) {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height)
  return canvasToBlob(canvas, mediaType === GIF ? PNG : mediaType)
}

/** The file as it will be sent: shrunk to at most 2000 px on the long edge, unchanged when it already fits. */
async function shrunk(file: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file)
  const size = shrinkToFit({ width: bitmap.width, height: bitmap.height })
  const fits = size.width === bitmap.width && size.height === bitmap.height
  // A GIF always goes through the canvas: only its first frame is sent.
  const blob = fits && file.type !== GIF ? file : await redraw(bitmap, size, file.type)
  bitmap.close()
  return blob
}

const refused = (reason: string): Preparation => ({ ok: false, reason })

export async function prepareImage(file: Blob): Promise<Preparation> {
  const typeReason = checkImageType(file.type)
  if (typeReason) return refused(typeReason.message)

  let blob: Blob | null
  try {
    blob = await shrunk(file)
  } catch {
    // createImageBitmap rejects a file it can't decode; the human is told, and nothing is attached.
    return refused('This file could not be read as an Image.')
  }
  if (!blob || !isImageMediaType(blob.type)) return refused('This file could not be read as an Image.')

  const sizeReason = checkImageBytes(blob.size)
  if (sizeReason) return refused(sizeReason.message)
  return { ok: true, image: { mediaType: blob.type, data: await readAsBase64(blob), size: blob.size } }
}
