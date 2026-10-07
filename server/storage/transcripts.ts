// Transcripts of Grilling Sessions (per Project) and Template Sessions (beside their working folders).
import fs from 'node:fs/promises'

import type { TemplateTranscript, Transcript } from '#core/session/sessionTypes.ts'

import { NotFound } from './errors.ts'
import { listJson, readJson, writeJson } from './fsUtil.ts'
import {
  templateSessionDir,
  templateSessionsDir,
  templateTranscriptFile,
  transcriptFile,
  transcriptsDir,
} from './paths.ts'

export const saveTranscript = (t: Transcript) => writeJson(transcriptFile(t.projectId, t.id), t)

export async function getTranscript(projectId: string, sessionId: string): Promise<Transcript> {
  const t = await readJson<Transcript>(transcriptFile(projectId, sessionId))
  if (!t) throw new NotFound(`No Transcript ${sessionId}`)
  return t
}

export async function listTranscripts(projectId: string, draftId?: string): Promise<Transcript[]> {
  const all = await listJson<Transcript>(transcriptsDir(projectId))
  return all.filter((t) => !draftId || t.draftId === draftId).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

/** Creates the Template Session's empty working folder. */
export async function makeTemplateSessionDir(sessionId: string) {
  const dir = templateSessionDir(sessionId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export const saveTemplateTranscript = (t: TemplateTranscript) => writeJson(templateTranscriptFile(t.id), t)

export async function getTemplateTranscript(sessionId: string): Promise<TemplateTranscript> {
  const t = await readJson<TemplateTranscript>(templateTranscriptFile(sessionId))
  if (!t) throw new NotFound(`No Template Session ${sessionId}`)
  return t
}

export const listTemplateTranscripts = () => listJson<TemplateTranscript>(templateSessionsDir)
