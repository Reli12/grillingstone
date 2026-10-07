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
export const glossaryFile = (projectId: string) => path.join(projectDir(projectId), 'CONTEXT.md')

/** Each Template Session runs in its own empty folder; its Transcript is kept beside it, out of its reach. */
export const templateSessionsDir = path.join(DATA_DIR, 'template-sessions')
export const templateSessionDir = (sessionId: string) => path.join(templateSessionsDir, safeId(sessionId))
export const templateTranscriptFile = (sessionId: string) => path.join(templateSessionsDir, `${safeId(sessionId)}.json`)

export const userTemplatesDir = path.join(DATA_DIR, 'templates')
export const settingsFile = path.join(DATA_DIR, 'settings.json')
