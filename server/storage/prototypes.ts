// Prototype storage (ADR-0023), in the Project's folder:
//   prototypes/<id>.html         the stored, self-contained page (what is viewed and downloaded)
//   prototypes/<id>.source.html  Claude's file as submitted
//   prototypes/<id>.json         the record: optional Draft link (id and version), who wrote it, time written, starting
//                                Prototype, Images, assumptions; a record from before the widening still reads
//   prototypes/<id>.images/N.ext the Images the page shows (bytes), for a Prototype started from this one
//   prototype-sessions/<id>.json one session's record, and prototype-sessions/<id>/N.ext its extra Images
//   prototype-grilling-sessions/<id>.json a Prototype Grilling Session's record, and .../<id>/N.ext its own Images
// A Prototype appears with all three files or not at all, and every id is checked to be a safe path segment.
import fs from 'node:fs/promises'

import {
  type Prototype,
  type PrototypeGrillingSession,
  prototypeGrillingSessionSchema,
  type PrototypeInputsRecord,
  prototypeSchema,
  type PrototypeSession,
  prototypeSessionSchema,
} from '#core/prototype/prototypeRecords.ts'
import { imageExtension, type ImageMediaType, type ValidImage } from '#core/session/images.ts'

import { NotFound } from './errors.ts'
import { isMissingFile, listJson, readJson, readText, writeFileAtomic, writeJson } from './fsUtil.ts'
import {
  prototypeExtraImageFile,
  prototypeExtraImagesDir,
  prototypeFile,
  prototypeGrillingImageFile,
  prototypeGrillingImagesDir,
  prototypeGrillingSessionFile,
  prototypeGrillingSessionsDir,
  prototypeImageFile,
  prototypeImagesDir,
  prototypesDir,
  prototypeSessionFile,
  prototypeSessionsDir,
} from './paths.ts'
import { getProject } from './projects.ts'

/** An Image added on the start form, by its number among the session's extra Images. */
type ExtraImageRef = PrototypeInputsRecord['extraImages'][number]

// ── Prototypes ──────────────────────────────────────────────────────────────

/** The files of a Prototype to write, besides its record. */
export interface PrototypeFiles {
  /** The stored, self-contained page. */
  html: string
  /** Claude's file as submitted. */
  source: string
  /** The Images the page shows, kept so a Prototype started from this one can use them again. */
  images?: Array<ValidImage & { number: number }>
}

/**
 * Writes the Images and the two pages, then the record last: a Prototype is listed and served only once its record
 * exists, so a crash or a failed write never leaves a half-written one visible. A failed write removes the rest again.
 */
export async function savePrototype(prototype: Prototype, { html, source, images = [] }: PrototypeFiles) {
  const { projectId, id } = prototype
  const pages = [prototypeFile(projectId, id, 'html'), prototypeFile(projectId, id, 'source.html')]
  try {
    for (const { number, mediaType, data } of images) {
      const file = prototypeImageFile(projectId, id, number, imageExtension(mediaType))
      await writeFileAtomic(file, Buffer.from(data, 'base64'))
    }
    await writeFileAtomic(pages[0], html)
    await writeFileAtomic(pages[1], source)
    await writeJson(prototypeFile(projectId, id, 'json'), prototype)
  } catch (error) {
    await Promise.all(pages.map((page) => fs.rm(page, { force: true })))
    await fs.rm(prototypeImagesDir(projectId, id), { recursive: true, force: true })
    throw error
  }
}

/** The Images a Prototype shows, with where each came from; one whose file is gone is left out. */
export async function readPrototypeImages(projectId: string, prototypeId: string) {
  const { images } = await getPrototype(projectId, prototypeId)
  const read = await Promise.all(
    images.map(async ({ number, mediaType, source }) => {
      try {
        const bytes = await fs.readFile(prototypeImageFile(projectId, prototypeId, number, imageExtension(mediaType)))
        return [{ number, mediaType, source, data: bytes.toString('base64') }]
      } catch (error) {
        if (isMissingFile(error)) return []
        throw error
      }
    }),
  )
  return read.flat()
}

export async function getPrototype(projectId: string, prototypeId: string): Promise<Prototype> {
  const stored = await readJson<unknown>(prototypeFile(projectId, prototypeId, 'json'))
  if (stored === null) throw new NotFound(`No Prototype ${prototypeId}`)
  return prototypeSchema.parse(stored)
}

async function readPage(projectId: string, prototypeId: string, part: 'html' | 'source.html') {
  await getPrototype(projectId, prototypeId)
  const page = await readText(prototypeFile(projectId, prototypeId, part))
  if (page === null) throw new NotFound(`No Prototype ${prototypeId}`)
  return page
}

/** The stored page; a page without its record is not a Prototype. */
export const readPrototypeHtml = (projectId: string, prototypeId: string) => readPage(projectId, prototypeId, 'html')

/** Claude's file as it submitted it. */
export const readPrototypeSource = (projectId: string, prototypeId: string) =>
  readPage(projectId, prototypeId, 'source.html')

/** A Project's Prototypes, newest first; only one Draft's when `draftId` is given. */
export async function listPrototypes(projectId: string, draftId?: string): Promise<Prototype[]> {
  await getProject(projectId)
  const stored = await listJson<unknown>(prototypesDir(projectId))
  return stored
    .map((record) => prototypeSchema.parse(record))
    .filter((prototype) => !draftId || prototype.draft?.draftId === draftId)
    .sort((first, second) => second.writtenAt.localeCompare(first.writtenAt))
}

/** Deletes the Prototype's three files, and the record of the finished session that wrote it. */
export async function deletePrototype(projectId: string, prototypeId: string) {
  await getPrototype(projectId, prototypeId)
  // The record goes first, so a failure part-way never leaves a listed Prototype without its pages.
  await fs.rm(prototypeFile(projectId, prototypeId, 'json'))
  await fs.rm(prototypeFile(projectId, prototypeId, 'html'), { force: true })
  await fs.rm(prototypeFile(projectId, prototypeId, 'source.html'), { force: true })
  await fs.rm(prototypeImagesDir(projectId, prototypeId), { recursive: true, force: true })
  for (const session of await listPrototypeSessions(projectId))
    if (session.prototypeId === prototypeId) await deletePrototypeSession(projectId, session.id)
}

// ── Prototype Sessions ──────────────────────────────────────────────────────

export const savePrototypeSession = (session: PrototypeSession) =>
  writeJson(prototypeSessionFile(session.projectId, session.id), session)

export async function getPrototypeSession(projectId: string, sessionId: string): Promise<PrototypeSession> {
  const stored = await readJson<unknown>(prototypeSessionFile(projectId, sessionId))
  if (stored === null) throw new NotFound(`No Prototype Session ${sessionId}`)
  return prototypeSessionSchema.parse(stored)
}

/** A Project's Prototype Session records, oldest first; only one Draft's when `draftId` is given. */
export async function listPrototypeSessions(projectId: string, draftId?: string): Promise<PrototypeSession[]> {
  await getProject(projectId)
  const stored = await listJson<unknown>(prototypeSessionsDir(projectId))
  return stored
    .map((record) => prototypeSessionSchema.parse(record))
    .filter((session) => !draftId || session.draftId === draftId)
    .sort((first, second) => first.startedAt.localeCompare(second.startedAt))
}

/** Dismisses a session: its record and its extra Image copies. A session already gone is fine. */
export async function deletePrototypeSession(projectId: string, sessionId: string) {
  await fs.rm(prototypeSessionFile(projectId, sessionId), { force: true })
  await fs.rm(prototypeExtraImagesDir(projectId, sessionId), { recursive: true, force: true })
}

/** Copies the Images added on the start form beside the session's record, numbered from 1. */
export async function saveExtraImages(projectId: string, sessionId: string, images: ValidImage[]) {
  const refs: ExtraImageRef[] = []
  for (const [i, { mediaType, data }] of images.entries()) {
    const number = i + 1
    const file = prototypeExtraImageFile(projectId, sessionId, number, imageExtension(mediaType))
    await writeFileAtomic(file, Buffer.from(data, 'base64'))
    refs.push({ number, mediaType })
  }
  return refs
}

/** The extra Images a session was started with, as base64. */
export async function readExtraImages(
  projectId: string,
  sessionId: string,
  refs: ExtraImageRef[],
): Promise<ValidImage[]> {
  return Promise.all(
    refs.map(async ({ number, mediaType }) => {
      const file = prototypeExtraImageFile(projectId, sessionId, number, imageExtension(mediaType))
      try {
        return { mediaType, data: (await fs.readFile(file)).toString('base64') }
      } catch (error) {
        if (isMissingFile(error)) throw new NotFound(`No Image ${number} in Prototype Session ${sessionId}`)
        throw error
      }
    }),
  )
}

// ── Prototype Grilling Sessions ─────────────────────────────────────────────

export const savePrototypeGrillingSession = (session: PrototypeGrillingSession) =>
  writeJson(prototypeGrillingSessionFile(session.projectId, session.id), session)

export async function getPrototypeGrillingSession(
  projectId: string,
  sessionId: string,
): Promise<PrototypeGrillingSession> {
  const stored = await readJson<unknown>(prototypeGrillingSessionFile(projectId, sessionId))
  if (stored === null) throw new NotFound(`No Prototype Grilling Session ${sessionId}`)
  return prototypeGrillingSessionSchema.parse(stored)
}

/** A Project's Prototype Grilling Session records, oldest first; only those started from one Draft when `draftId` is given. */
export async function listPrototypeGrillingSessions(
  projectId: string,
  draftId?: string,
): Promise<PrototypeGrillingSession[]> {
  await getProject(projectId)
  const stored = await listJson<unknown>(prototypeGrillingSessionsDir(projectId))
  return stored
    .map((record) => prototypeGrillingSessionSchema.parse(record))
    .filter((session) => !draftId || session.draft?.draftId === draftId)
    .sort((first, second) => first.startedAt.localeCompare(second.startedAt))
}

/** Removes a session's record and its Image files. A session already gone is fine. */
export async function deletePrototypeGrillingSession(projectId: string, sessionId: string) {
  await fs.rm(prototypeGrillingSessionFile(projectId, sessionId), { force: true })
  await fs.rm(prototypeGrillingImagesDir(projectId, sessionId), { recursive: true, force: true })
}

/** Keeps the session's own Images beside its record, each under its number in the session. */
export async function saveGrillingImages(
  projectId: string,
  sessionId: string,
  images: Array<ValidImage & { number: number }>,
) {
  for (const { number, mediaType, data } of images) {
    const file = prototypeGrillingImageFile(projectId, sessionId, number, imageExtension(mediaType))
    await writeFileAtomic(file, Buffer.from(data, 'base64'))
  }
}

/** An Image of the session's own folder, by the number it has in the session. */
export async function readGrillingImage(
  projectId: string,
  sessionId: string,
  { number, mediaType }: { number: number; mediaType: ImageMediaType },
): Promise<Buffer> {
  try {
    return await fs.readFile(prototypeGrillingImageFile(projectId, sessionId, number, imageExtension(mediaType)))
  } catch (error) {
    if (isMissingFile(error)) throw new NotFound(`No Image ${number}`)
    throw error
  }
}

// ── Draft deletion ──────────────────────────────────────────────────────────

/**
 * Deletes everything Prototype-related of a Draft: its Prototypes, session records of both kinds and their Image
 * copies. A Prototype Grilling Session that started from no Draft is not the Draft's and stays.
 */
export async function deletePrototypesOf(projectId: string, draftId: string) {
  for (const prototype of await listPrototypes(projectId, draftId)) await deletePrototype(projectId, prototype.id)
  for (const session of await listPrototypeSessions(projectId, draftId))
    await deletePrototypeSession(projectId, session.id)
  for (const session of await listPrototypeGrillingSessions(projectId, draftId))
    await deletePrototypeGrillingSession(projectId, session.id)
}
