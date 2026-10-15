// Transcripts of Grilling Sessions (per Project) and Template Sessions (beside their working folders).
// Reads bring Transcripts saved before sessions named their Assistant up to the current shape.
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

/** How a Transcript saved before the Assistant seam named Claude Code's conversation. */
type Stored<T extends Transcript | TemplateTranscript> = Omit<T, 'assistant'> &
  Partial<Pick<T, 'assistant'>> & { claudeSessionId?: string }

/** Every Transcript from before the Assistant seam was held by Claude; its old id is the conversation to resume. */
function fromDisk<T extends Transcript | TemplateTranscript>({ claudeSessionId, ...stored }: Stored<T>): T {
  const conversationId = stored.conversationId ?? claudeSessionId
  return { ...stored, assistant: stored.assistant ?? 'claude', ...(conversationId ? { conversationId } : {}) } as T
}

export const saveTranscript = (transcript: Transcript) =>
  writeJson(transcriptFile(transcript.projectId, transcript.id), transcript)

export async function getTranscript(projectId: string, sessionId: string): Promise<Transcript> {
  const transcript = await readJson<Stored<Transcript>>(transcriptFile(projectId, sessionId))
  if (!transcript) throw new NotFound(`No Transcript ${sessionId}`)
  return fromDisk(transcript)
}

/** A Project's Transcripts, oldest first; only one Draft's when `draftId` is given. */
export async function listTranscripts(projectId: string, draftId?: string): Promise<Transcript[]> {
  const all = (await listJson<Stored<Transcript>>(transcriptsDir(projectId))).map(fromDisk)
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
  const transcript = await readJson<Stored<TemplateTranscript>>(templateTranscriptFile(sessionId))
  if (!transcript) throw new NotFound(`No Template Session ${sessionId}`)
  return fromDisk(transcript)
}

export const listTemplateTranscripts = async () =>
  (await listJson<Stored<TemplateTranscript>>(templateSessionsDir)).map(fromDisk)
