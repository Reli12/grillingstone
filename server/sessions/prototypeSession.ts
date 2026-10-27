// A Prototype Session runs in its own prepared folder (ADR-0023): the Draft as it stands, the Glossary and the
// numbered Images, nothing else. It is single-turn, takes no message after the start, and is not persisted. Its
// submission is the Prototype itself, stored through Prototype storage.
import fs from 'node:fs/promises'
import path from 'node:path'

import { IMAGES_FOLDER } from '#core/prototype/prototypeFiles.ts'
import { buildPrototypeInputs, type PrototypeImage, type StartingPrototype } from '#core/prototype/prototypeInputs.ts'
import { type PrototypeSession, prototypeSummaryOf, type TickedImage } from '#core/prototype/prototypeRecords.ts'
import { buildPrototypeSeed } from '#core/prototype/prototypeSeed.ts'
import { PROTOTYPE_SUBMIT_LABEL } from '#core/prototype/prototypeStep.ts'
import {
  base64ByteLength,
  type ImageUpload,
  parseMessageImages,
  PROTOTYPE_IMAGES_TOO_LARGE,
  SESSION_IMAGE_WARNING_BYTES,
} from '#core/session/images.ts'
import type { PrototypeStep } from '#core/session/sessionTypes.ts'
import { newId } from '#core/shared/ids.ts'
import { plural } from '#core/shared/plural.ts'

import { SUBMIT_SCRIPT } from '../config.ts'
import type { Hub } from '../hub.ts'
import { now } from '../services/clock.ts'
import { getDraft } from '../storage/drafts.ts'
import { getGlossary } from '../storage/glossary.ts'
import { readImage } from '../storage/images.ts'
import { prototypeWorkDir } from '../storage/paths.ts'
import { getProject } from '../storage/projects.ts'
import {
  deletePrototypeSession,
  getPrototype,
  readPrototypeImages,
  readPrototypeSource,
  saveExtraImages,
  savePrototype,
  savePrototypeSession,
} from '../storage/prototypes.ts'
import { listTranscripts } from '../storage/transcripts.ts'
import { prototypeSubmitter, type StoredPrototype } from './prototypeSubmitter.ts'
import { SessionError } from './sessionError.ts'
import { humanImageRefs } from './sessionImages.ts'
import type { AnyTranscript, PreparedSession, Scope } from './sessionScope.ts'

export interface PrototypeSessionDeps {
  hub: Hub
}

export interface PrototypeStartArgs {
  projectId: string
  draftId: string
  /** Images of the Draft's Grilling Sessions, ticked on the start form. */
  tickedImages: TickedImage[]
  /** Images added on the start form. */
  extraImages: ImageUpload[]
  /** An earlier Prototype of the same Draft to start from. */
  startingPrototypeId?: string
}

const BELOW_V1 = 'A Prototype needs a Draft at v1 or later.'
const OTHER_DRAFT = "That Prototype belongs to another Draft, so it can't be a starting point."

/** A Grilling Session's Image as the start form lists it: where it came from, and its bytes. */
async function tickedImagesOf(args: PrototypeStartArgs): Promise<PrototypeImage[]> {
  const { projectId, draftId, tickedImages } = args
  // Oldest Grilling Session first, then by number: the order the Images are numbered in.
  const transcripts = await listTranscripts(projectId, draftId)
  const wanted = tickedImages.map((ticked) => {
    const transcript = transcripts.find((candidate) => candidate.id === ticked.sessionId)
    const refs = transcript ? humanImageRefs(transcript) : []
    const image = refs.find((candidate) => candidate.number === ticked.number)
    if (!transcript || !image) throw new SessionError(`Image ${ticked.number} is not one of this Draft's Images.`)
    return { transcript, order: transcripts.indexOf(transcript), ...ticked, mediaType: image.mediaType }
  })
  const sameImage = (a: TickedImage, b: TickedImage) => a.sessionId === b.sessionId && a.number === b.number
  const unique = wanted.filter((image, i) => wanted.findIndex((other) => sameImage(image, other)) === i)
  unique.sort((first, second) => first.order - second.order || first.number - second.number)
  return Promise.all(
    unique.map(async ({ transcript, sessionId, number, mediaType }) => {
      const bytes = await readImage({ projectId, sessionId, number, mediaType })
      const day = transcript.startedAt.slice(0, 10)
      return { mediaType, data: bytes.toString('base64'), source: `Grilling Session of ${day}, Image ${number}` }
    }),
  )
}

/**
 * The earlier Prototype as the new session starts from it: Claude's file as it submitted it, its assumptions and the
 * Images it showed. It must be one of this Draft's.
 */
async function startingPrototypeOf(
  { projectId, draftId }: PrototypeStartArgs,
  prototypeId: string,
): Promise<StartingPrototype> {
  const prototype = await getPrototype(projectId, prototypeId)
  if (prototype.draftId !== draftId) throw new SessionError(OTHER_DRAFT)
  const [html, images] = await Promise.all([
    readPrototypeSource(projectId, prototypeId),
    readPrototypeImages(projectId, prototypeId),
  ])
  return { html, assumptions: prototype.assumptions, images }
}

/** The session's working folder: the Draft, the Glossary, images.md and the Image files. */
async function writeWorkFolder(dir: string, inputs: ReturnType<typeof buildPrototypeInputs>) {
  await fs.mkdir(path.join(dir, IMAGES_FOLDER), { recursive: true })
  for (const { path: file, content } of inputs.textFiles) await fs.writeFile(path.join(dir, file), content)
  for (const image of inputs.images) await fs.writeFile(path.join(dir, image.path), Buffer.from(image.data, 'base64'))
}

export async function preparePrototypeSession(
  args: PrototypeStartArgs,
  deps: PrototypeSessionDeps,
): Promise<PreparedSession<PrototypeSession>> {
  const { projectId, draftId, startingPrototypeId } = args
  const [project, draft, glossary] = await Promise.all([
    getProject(projectId),
    getDraft(projectId, draftId),
    getGlossary(projectId),
  ])
  if (draft.version < 1) throw new SessionError(BELOW_V1)
  const extra = parseMessageImages(args.extraImages)
  if (!extra.ok) throw new SessionError(extra.reasons.map((reason) => reason.message).join(' '))
  const starting = startingPrototypeId ? await startingPrototypeOf(args, startingPrototypeId) : undefined
  const ticked = await tickedImagesOf(args)
  // The Images kept from the starting Prototype are files only and do not count towards the limit.
  const totalBytes = [...ticked, ...extra.images].reduce((total, image) => total + base64ByteLength(image.data), 0)
  if (totalBytes > SESSION_IMAGE_WARNING_BYTES) throw new SessionError(PROTOTYPE_IMAGES_TOO_LARGE)

  const inputs = buildPrototypeInputs({ draft, glossary: glossary.markdown, ticked, extra: extra.images, starting })
  const id = newId('psess')
  const workDir = prototypeWorkDir(id)
  const abandon = async () => {
    await fs.rm(workDir, { recursive: true, force: true })
    await deletePrototypeSession(projectId, id)
  }
  try {
    await writeWorkFolder(workDir, inputs)
    const extraImages = await saveExtraImages(projectId, id, extra.images)
    const record: PrototypeSession = {
      id,
      kind: 'prototype',
      projectId,
      draftId,
      draftVersion: draft.version,
      status: 'starting',
      writeConfirmed: true,
      startedAt: now(),
      inputs: {
        tickedImages: args.tickedImages,
        extraImages,
        ...(startingPrototypeId ? { startingPrototypeId } : {}),
      },
      messages: [],
    }
    const store = async ({ source, html, assumptions, usedImages }: StoredPrototype) => {
      const prototypeId = newId('proto')
      const shown = inputs.images.filter((image) => usedImages.includes(image.number))
      await savePrototype(
        {
          id: prototypeId,
          projectId,
          draftId,
          draftVersion: draft.version,
          writtenAt: now(),
          ...(startingPrototypeId ? { startingPrototypeId } : {}),
          images: shown.map(({ number, mediaType, source: from }) => ({ number, mediaType, source: from })),
          assumptions,
        },
        { html, source, images: shown },
      )
      record.prototypeId = prototypeId
      deps.hub.broadcast({ type: 'prototypes', projectId })
    }
    const seed = buildPrototypeSeed({
      projectName: project.name,
      draftTitle: draft.title,
      draftVersion: draft.version,
      hasImages: inputs.messageImages.length > 0,
      hasStartingPrototype: starting !== undefined,
      submitCommand: `node "${SUBMIT_SCRIPT}"`,
    })
    const imageCount = plural(inputs.messageImages.length, 'Image')
    const submitter = prototypeSubmitter({ sessionDir: workDir, images: inputs.images, store })
    return {
      transcript: record,
      seed,
      intro: `Prototype Session started for Draft v${draft.version}. Claude has the Draft, the Glossary and ${imageCount}.`,
      numberedImages: inputs.messageImages,
      scope: prototypeScope(record, workDir, deps, submitter),
      abandon,
    }
  } catch (error) {
    await abandon().catch(() => undefined)
    throw error
  }
}

function prototypeScope(
  { projectId }: PrototypeSession,
  workDir: string,
  deps: PrototypeSessionDeps,
  submit: Scope['submit'],
): Scope {
  // The Supervisor hands a scope back the Transcript it was prepared with, which is this session's record.
  const own = (transcript: AnyTranscript) => transcript as PrototypeSession
  const announce = (transcript: AnyTranscript) =>
    deps.hub.broadcast({ type: 'prototypeSession', projectId, session: prototypeSummaryOf(own(transcript)) })
  let announcedStep: PrototypeStep | undefined
  return {
    cwd: workDir,
    guardMode: 'prototype',
    persist: false,
    singleTurn: true,
    save: (transcript) => savePrototypeSession(own(transcript)),
    // A Prototype Session has no chat in the UI; a message is announced only when it changes Claude's step.
    emitMessage: (transcript) => {
      const { step } = prototypeSummaryOf(own(transcript))
      if (step === announcedStep) return
      announcedStep = step
      announce(transcript)
    },
    emitSession: (transcript) => {
      announcedStep = prototypeSummaryOf(own(transcript)).step
      announce(transcript)
      deps.hub.broadcast({ type: 'prototypes', projectId })
    },
    submit,
    submitLabel: PROTOTYPE_SUBMIT_LABEL,
    release: () => fs.rm(workDir, { recursive: true, force: true }),
  }
}
