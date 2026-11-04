// Images of Grilling Sessions, kept in the Project's folder: images/<sessionId>/<number>.<ext>.
import fs from 'node:fs/promises'

import { imageExtension,type ImageMediaType } from '#core/session/images.ts'

import { NotFound } from './errors.ts'
import { isMissingFile, writeFileAtomic } from './fsUtil.ts'
import { imageFile, sessionImagesDir } from './paths.ts'

/** Which file an Image is: the Project, the session and the number say where; the media type, which extension. */
export interface ImageLocation {
  projectId: string
  sessionId: string
  number: number
  mediaType: ImageMediaType
}

const fileOf = ({ projectId, sessionId, number, mediaType }: ImageLocation) =>
  imageFile(projectId, sessionId, number, imageExtension(mediaType))

/** Saves an Image from its base64 data. */
export async function saveImage(image: ImageLocation & { data: string }) {
  await writeFileAtomic(fileOf(image), Buffer.from(image.data, 'base64'))
}

export async function readImage(image: ImageLocation): Promise<Buffer> {
  try {
    return await fs.readFile(fileOf(image))
  } catch (error) {
    if (isMissingFile(error)) throw new NotFound(`No Image ${image.number}`)
    throw error
  }
}

/** An Image's size on disk, or undefined when its file is gone. */
export async function imageBytes(image: ImageLocation): Promise<number | undefined> {
  try {
    return (await fs.stat(fileOf(image))).size
  } catch (error) {
    if (isMissingFile(error)) return undefined
    throw error
  }
}

/** Deletes all of a session's Images; a session without any is fine. */
export async function deleteSessionImages(projectId: string, sessionId: string) {
  await fs.rm(sessionImagesDir(projectId, sessionId), { recursive: true, force: true })
}
