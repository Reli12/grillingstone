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

export const saveTranscript = (transcript: Transcript) =>
  writeJson(transcriptFile(transcript.projectId, transcript.id), transcript)

export async function getTranscript(projectId: string, sessionId: string): Promise<Transcript> {
  const transcript = await readJson<Transcript>(transcriptFile(projectId, sessionId))
  if (!transcript) throw new NotFound(`No Transcript ${sessionId}`)
  return transcript
}

/** A Project's Transcripts, oldest first; only one Draft's when `draftId` is given. */
export async function listTranscripts(projectId: string, draftId?: string): Promise<Transcript[]> {
  const all = await listJson<Transcript>(transcriptsDir(projectId))
  const wanted = all.filter((transcript) => !draftId || transcript.draftId === draftId)
  return wanted.sort((first, second) => first.startedAt.localeCompare(second.startedAt))
}

/** Creates the Template Session's empty working folder. */
export async function makeTemplateSessionDir(sessionId: string) {
  const dir = templateSessionDir(sessionId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export const saveTemplateTranscript = (transcript: TemplateTranscript) =>
  writeJson(templateTranscriptFile(transcript.id), transcript)

export async function getTemplateTranscript(sessionId: string): Promise<TemplateTranscript> {
  const transcript = await readJson<TemplateTranscript>(templateTranscriptFile(sessionId))
  if (!transcript) throw new NotFound(`No Template Session ${sessionId}`)
  return transcript
}

export const listTemplateTranscripts = () => listJson<TemplateTranscript>(templateSessionsDir)
