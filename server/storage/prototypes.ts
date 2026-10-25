// Prototype storage (ADR-0023), in the Project's folder:
//   prototypes/<id>.html         the stored, self-contained page (what is viewed and downloaded)
//   prototypes/<id>.source.html  Claude's file as submitted
//   prototypes/<id>.json         the record: Draft id and version, time written, starting Prototype, Images, assumptions
//   prototype-sessions/<id>.json one session's record, and prototype-sessions/<id>/N.ext its extra Images
// A Prototype appears with all three files or not at all, and every id is checked to be a safe path segment.
import fs from 'node:fs/promises'

import {
  type Prototype,
  type PrototypeInputsRecord,
  prototypeSchema,
  type PrototypeSession,
  prototypeSessionSchema,
} from '#core/prototype/prototypeRecords.ts'
import type { ValidImage } from '#core/session/images.ts'

import { NotFound } from './errors.ts'
import { isMissingFile, listJson, readJson, readText, writeFileAtomic, writeJson } from './fsUtil.ts'
import { imageExtension } from './images.ts'
import {
  prototypeExtraImageFile,
  prototypeExtraImagesDir,
  prototypeFile,
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
}

/**
 * Writes the two pages, then the record last: a Prototype is listed and served only once its record exists, so a
 * crash or a failed write never leaves a half-written one visible. A failed write removes the pages again.
 */
export async function savePrototype(prototype: Prototype, { html, source }: PrototypeFiles) {
  const { projectId, id } = prototype
  const pages = [prototypeFile(projectId, id, 'html'), prototypeFile(projectId, id, 'source.html')]
  try {
    await writeFileAtomic(pages[0], html)
    await writeFileAtomic(pages[1], source)
    await writeJson(prototypeFile(projectId, id, 'json'), prototype)
  } catch (error) {
    await Promise.all(pages.map((page) => fs.rm(page, { force: true })))
    throw error
  }
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
    .filter((prototype) => !draftId || prototype.draftId === draftId)
    .sort((first, second) => second.writtenAt.localeCompare(first.writtenAt))
}

/** Deletes the Prototype's three files, and the record of the finished session that wrote it. */
export async function deletePrototype(projectId: string, prototypeId: string) {
  await getPrototype(projectId, prototypeId)
  // The record goes first, so a failure part-way never leaves a listed Prototype without its pages.
  await fs.rm(prototypeFile(projectId, prototypeId, 'json'))
  await fs.rm(prototypeFile(projectId, prototypeId, 'html'), { force: true })
  await fs.rm(prototypeFile(projectId, prototypeId, 'source.html'), { force: true })
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

// ── Draft deletion ──────────────────────────────────────────────────────────

/** Deletes everything Prototype-related of a Draft: its Prototypes, session records and extra Image copies. */
export async function deletePrototypesOf(projectId: string, draftId: string) {
  for (const prototype of await listPrototypes(projectId, draftId)) await deletePrototype(projectId, prototype.id)
  for (const session of await listPrototypeSessions(projectId, draftId))
    await deletePrototypeSession(projectId, session.id)
}
