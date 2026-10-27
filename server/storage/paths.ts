// Where each kind of state lives under DATA_DIR (ADR-0009). Ids become file names, so each one is
// checked to be a single safe path segment first.
import path from 'node:path'

import { DATA_DIR } from '../config.ts'
import { NotFound } from './errors.ts'
import { isSafeId } from './fsUtil.ts'

/** Returns the id when it is a safe single path segment; otherwise the thing cannot exist. */
export const safeId = (value: string) => {
  if (!isSafeId(value)) throw new NotFound(`Invalid id ${value}`)
  return value
}

export const projectsDir = path.join(DATA_DIR, 'projects')
export const projectDir = (projectId: string) => path.join(projectsDir, safeId(projectId))
export const projectFile = (projectId: string) => path.join(projectDir(projectId), 'project.json')
export const draftsDir = (projectId: string) => path.join(projectDir(projectId), 'drafts')
export const draftFile = (projectId: string, draftId: string, ext: 'json' | 'md') =>
  path.join(draftsDir(projectId), `${safeId(draftId)}.${ext}`)
export const transcriptsDir = (projectId: string) => path.join(projectDir(projectId), 'transcripts')
export const transcriptFile = (projectId: string, sessionId: string) =>
  path.join(transcriptsDir(projectId), `${safeId(sessionId)}.json`)
/** A session's Images: images/<sessionId>/<number>.<ext> inside the Project, so a Project's data stays in one place. */
export const sessionImagesDir = (projectId: string, sessionId: string) =>
  path.join(projectDir(projectId), 'images', safeId(sessionId))
/** An Image file named by its number, <number>.<ext>, in the given folder; a number below 1 is no Image's. */
const numberedImageFile = (dir: string, number: number, ext: string) => {
  if (!Number.isInteger(number) || number < 1) throw new NotFound(`Invalid Image number ${number}`)
  return path.join(dir, `${number}.${ext}`)
}
export const imageFile = (projectId: string, sessionId: string, number: number, ext: string) =>
  numberedImageFile(sessionImagesDir(projectId, sessionId), number, ext)
export const glossaryFile = (projectId: string) => path.join(projectDir(projectId), 'CONTEXT.md')

/** A Project's Prototypes (ADR-0023): <id>.html is the stored page, <id>.source.html Claude's file, <id>.json the record. */
export const prototypesDir = (projectId: string) => path.join(projectDir(projectId), 'prototypes')
export const prototypeFile = (projectId: string, prototypeId: string, part: 'html' | 'source.html' | 'json') =>
  path.join(prototypesDir(projectId), `${safeId(prototypeId)}.${part}`)
/** The Images a Prototype shows, kept beside it as <number>.<ext>, so a Prototype started from it can use them again. */
export const prototypeImagesDir = (projectId: string, prototypeId: string) =>
  path.join(prototypesDir(projectId), `${safeId(prototypeId)}.images`)
export const prototypeImageFile = (projectId: string, prototypeId: string, number: number, ext: string) =>
  numberedImageFile(prototypeImagesDir(projectId, prototypeId), number, ext)
/** The records of a Project's Prototype Sessions; a session's extra Images are copied into a folder of its id beside it. */
export const prototypeSessionsDir = (projectId: string) => path.join(projectDir(projectId), 'prototype-sessions')
export const prototypeSessionFile = (projectId: string, sessionId: string) =>
  path.join(prototypeSessionsDir(projectId), `${safeId(sessionId)}.json`)
export const prototypeExtraImagesDir = (projectId: string, sessionId: string) =>
  path.join(prototypeSessionsDir(projectId), safeId(sessionId))
export const prototypeExtraImageFile = (projectId: string, sessionId: string, number: number, ext: string) =>
  numberedImageFile(prototypeExtraImagesDir(projectId, sessionId), number, ext)
/**
 * The records of a Project's Prototype Grilling Sessions. A session's own Images (added on the start form or in the
 * conversation) are kept in a folder of its id beside the record, named by their number in the session.
 */
export const prototypeGrillingSessionsDir = (projectId: string) =>
  path.join(projectDir(projectId), 'prototype-grilling-sessions')
export const prototypeGrillingSessionFile = (projectId: string, sessionId: string) =>
  path.join(prototypeGrillingSessionsDir(projectId), `${safeId(sessionId)}.json`)
export const prototypeGrillingImagesDir = (projectId: string, sessionId: string) =>
  path.join(prototypeGrillingSessionsDir(projectId), safeId(sessionId))
export const prototypeGrillingImageFile = (projectId: string, sessionId: string, number: number, ext: string) =>
  numberedImageFile(prototypeGrillingImagesDir(projectId, sessionId), number, ext)
/** A Prototype Session runs in its own folder, outside every Project, and removes it when it ends. */
export const prototypeWorkDir = (sessionId: string) => path.join(DATA_DIR, 'prototype-work', safeId(sessionId))

/** Each Template Session runs in its own empty folder; its Transcript is kept beside it, out of its reach. */
export const templateSessionsDir = path.join(DATA_DIR, 'template-sessions')
export const templateSessionDir = (sessionId: string) => path.join(templateSessionsDir, safeId(sessionId))
export const templateTranscriptFile = (sessionId: string) => path.join(templateSessionsDir, `${safeId(sessionId)}.json`)

export const userTemplatesDir = path.join(DATA_DIR, 'templates')
export const settingsFile = path.join(DATA_DIR, 'settings.json')
