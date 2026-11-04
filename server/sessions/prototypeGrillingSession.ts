// A Prototype Grilling Session (ADR-0024) runs in its own prepared folder: the optional Draft as it stands, the
// Glossary, the numbered Images and the starting Prototype. It is a conversation: Claude grills the human, writes the
// first Prototype after a Ready Check, and writes one more for each message of feedback. Every successful submit
// stores a new Prototype; prototype.html stays in the folder as the next round's starting point.
import fs from 'node:fs/promises'
import path from 'node:path'

import type { PrototypeAssumption } from '#core/prototype/prototypeAssembly.ts'
import { IMAGES_FOLDER } from '#core/prototype/prototypeFiles.ts'
import { buildPrototypeGrillingInputs, buildRoundAdditions } from '#core/prototype/prototypeGrillingInputs.ts'
import { buildPrototypeGrillingSeed } from '#core/prototype/prototypeGrillingSeed.ts'
import type { InputFile, InputImage } from '#core/prototype/prototypeInputs.ts'
import {
  chainOfContinuation,
  nextRoundOf,
  type PrototypeGrillingSession,
  prototypeGrillingSummaryOf,
  type TickedImage,
} from '#core/prototype/prototypeRecords.ts'
import { PROTOTYPE_SUBMIT_LABEL } from '#core/prototype/prototypeStep.ts'
import { type ImageRef, type ImageUpload, parseMessageImages, type ValidImage } from '#core/session/images.ts'
import type { PrototypeStep } from '#core/session/sessionTypes.ts'
import { newId } from '#core/shared/ids.ts'
import { plural } from '#core/shared/plural.ts'

import { SUBMIT_SCRIPT } from '../config.ts'
import type { Hub } from '../hub.ts'
import { now } from '../services/clock.ts'
import { getDraft } from '../storage/drafts.ts'
import { getGlossary } from '../storage/glossary.ts'
import { prototypeWorkDir } from '../storage/paths.ts'
import { getProject } from '../storage/projects.ts'
import {
  deletePrototypeGrillingSession,
  readGrillingImage,
  saveGrillingImages,
  savePrototype,
  savePrototypeGrillingSession,
} from '../storage/prototypes.ts'
import { BELOW_V1, startingPrototypeOf, tickedImagesOf, writeWorkFolder } from './prototypeSession.ts'
import { prototypeSubmitter, type StoredPrototype } from './prototypeSubmitter.ts'
import { SessionError } from './sessionError.ts'
import type { AnyTranscript, ConversationImages, PreparedSession, Scope } from './sessionScope.ts'

export interface PrototypeGrillingDeps {
  hub: Hub
}

export interface PrototypeGrillingStartArgs {
  projectId: string
  /** The one Draft the session illustrates, at v1 or later; none for a session that starts from words and Images. */
  draftId?: string
  /** Images of the Draft's Grilling Sessions, ticked on the start form; only with a Draft. */
  tickedImages: TickedImage[]
  /** Images added on the start form. */
  extraImages: ImageUpload[]
  /** An earlier Prototype of the same Project to start from. */
  startingPrototypeId?: string
  /**
   * A Continuation: the ended session whose Claude Code conversation is resumed. The rules that decide the Draft and
   * the starting Prototype are core's (prototypeGrillingContinuation); the caller has applied them to the fields above.
   */
  continues?: { earlier: PrototypeGrillingSession }
}

const TICKED_NEED_DRAFT = 'Images of a Draft’s Grilling Sessions can only be ticked with a Draft.'
const STOPPED_NOTE = 'Session stopped. The Prototypes written so far are kept.'

/** The Prototype a round wrote, as the next round starts from it: Claude's file as submitted, and its assumptions. */
interface RoundResult {
  html: string
  assumptions: PrototypeAssumption[]
  prototypeId: string
}

/** What a session keeps in memory between its rounds: the Images it has numbered, and its newest Prototype. */
interface RoundState {
  images: InputImage[]
  latest?: RoundResult
}

const CARRIED_IMAGE_SOURCE = 'Carried over from the session this one continues'

/** The Images the ended session added itself (start form and conversation), with the numbers it gave them. */
async function carriedImagesOf(earlier: PrototypeGrillingSession) {
  const sent = earlier.messages.flatMap((message) => (message.role === 'human' ? (message.images ?? []) : []))
  const refs = [...earlier.inputs.extraImages, ...sent].filter(
    (ref, i, all) => all.findIndex((other) => other.number === ref.number) === i,
  )
  return Promise.all(
    refs.map(async (ref) => ({
      number: ref.number,
      mediaType: ref.mediaType,
      data: (await readGrillingImage(earlier.projectId, earlier.id, ref)).toString('base64'),
      source: CARRIED_IMAGE_SOURCE,
    })),
  )
}

async function writeFiles(dir: string, files: InputFile[], images: InputImage[]) {
  await fs.mkdir(path.join(dir, IMAGES_FOLDER), { recursive: true })
  for (const { path: file, content } of files) await fs.writeFile(path.join(dir, file), content)
  for (const image of images) await fs.writeFile(path.join(dir, image.path), Buffer.from(image.data, 'base64'))
}

export async function preparePrototypeGrillingSession(
  args: PrototypeGrillingStartArgs,
  deps: PrototypeGrillingDeps,
): Promise<PreparedSession<PrototypeGrillingSession>> {
  const { projectId, draftId, startingPrototypeId } = args
  if (!draftId && args.tickedImages.length) throw new SessionError(TICKED_NEED_DRAFT)
  const [project, draft, glossary] = await Promise.all([
    getProject(projectId),
    draftId ? getDraft(projectId, draftId) : undefined,
    getGlossary(projectId),
  ])
  if (draft && draft.version < 1) throw new SessionError(BELOW_V1)
  const extra = parseMessageImages(args.extraImages)
  if (!extra.ok) throw new SessionError(extra.reasons.map((reason) => reason.message).join(' '))
  const starting = startingPrototypeId ? await startingPrototypeOf(projectId, startingPrototypeId) : undefined
  const ticked = draftId ? await tickedImagesOf({ projectId, draftId, tickedImages: args.tickedImages }) : []
  const earlier = args.continues?.earlier
  const carried = earlier ? await carriedImagesOf(earlier) : []

  const built = buildPrototypeGrillingInputs({
    ...(draft ? { draft } : {}),
    glossary: glossary.markdown,
    ticked,
    extra: extra.images,
    carried,
    starting,
  })
  if (!built.ok) throw new SessionError(built.reason)
  const { inputs } = built

  const id = newId('pgsess')
  // Claude Code keys a stored conversation by its working directory: every session of a chain of Continuations works
  // in the folder named by the chain's first session, rebuilt fresh for each of them.
  const chain = earlier ? chainOfContinuation(earlier) : undefined
  const workDir = prototypeWorkDir(chain?.chainId ?? id)
  const abandon = async () => {
    await fs.rm(workDir, { recursive: true, force: true })
    await deletePrototypeGrillingSession(projectId, id)
  }
  try {
    await fs.rm(workDir, { recursive: true, force: true })
    await writeWorkFolder(workDir, inputs)
    // The Images added on the start form are numbered by the session, after the ticked ones; a Continuation keeps
    // the earlier session's own Images at the numbers they had.
    const own = earlier ? carried : inputs.images.slice(ticked.length, ticked.length + extra.images.length)
    await saveGrillingImages(projectId, id, own)
    const draftLink = draft ? { draftId: draft.id, draftVersion: draft.version } : undefined
    const record: PrototypeGrillingSession = {
      id,
      kind: 'prototypeGrilling',
      projectId,
      ...(draftLink ? { draft: draftLink } : {}),
      ...(earlier ? { continues: earlier.id, claudeSessionId: earlier.claudeSessionId } : {}),
      ...chain,
      status: 'starting',
      // A Continuation of a session that already wrote a Prototype takes feedback rounds at once.
      writeConfirmed: (chain?.priorRounds ?? 0) > 0,
      startedAt: now(),
      inputs: {
        tickedImages: args.tickedImages,
        extraImages: own.map(({ number, mediaType }) => ({ number, mediaType })),
        ...(startingPrototypeId ? { startingPrototypeId } : {}),
      },
      prototypeIds: [],
      messages: [],
    }
    const state: RoundState = { images: inputs.images }
    const seed = buildPrototypeGrillingSeed({
      projectName: project.name,
      ...(draft ? { draft: { title: draft.title, version: draft.version } } : {}),
      // A Continuation does not send the Images again: Claude Code's conversation has them.
      hasImages: !earlier && inputs.messageImages.length > 0,
      hasStartingPrototype: starting !== undefined,
      submitCommand: `node "${SUBMIT_SCRIPT}"`,
      ...(earlier ? { continuing: true } : {}),
    })
    const where = draft ? `for Draft v${draft.version}` : 'with no Draft'
    const imageCount = plural(inputs.images.length, 'Image')
    const intro = earlier
      ? `Continuing the earlier conversation ${where}. Claude remembers it, and has the Glossary, ${imageCount} and the newest Prototype as they are now.`
      : `Prototype Grilling Session started ${where}. Claude has the Glossary and ${plural(inputs.messageImages.length, 'Image')}.`
    return {
      transcript: record,
      seed,
      intro,
      ...(earlier ? { resume: earlier.claudeSessionId } : {}),
      numberedImages: earlier ? [] : inputs.messageImages,
      scope: grillingScope({ record, workDir, state, deps }),
      abandon,
    }
  } catch (error) {
    await abandon().catch(() => undefined)
    throw error
  }
}

interface ScopeContext {
  record: PrototypeGrillingSession
  workDir: string
  state: RoundState
  deps: PrototypeGrillingDeps
}

/** Stores the Prototype a round submitted, makes it the next round's starting point and lists it on the session. */
function roundStore({ record, workDir, state, deps }: ScopeContext) {
  return async ({ source, html, assumptions, usedImages }: StoredPrototype) => {
    const { projectId } = record
    const prototypeId = newId('proto')
    const shown = state.images.filter((image) => usedImages.includes(image.number))
    const startingPrototypeId = record.prototypeIds.at(-1) ?? record.inputs.startingPrototypeId
    await savePrototype(
      {
        id: prototypeId,
        projectId,
        ...(record.draft ? { draft: record.draft } : {}),
        writtenBy: { kind: 'prototypeGrilling', sessionId: record.id, round: nextRoundOf(record) },
        writtenAt: now(),
        ...(startingPrototypeId ? { startingPrototypeId } : {}),
        images: shown.map(({ number, mediaType, source: from }) => ({ number, mediaType, source: from })),
        assumptions,
      },
      { html, source, images: shown },
    )
    record.prototypeIds.push(prototypeId)
    state.latest = { html: source, assumptions, prototypeId }
    // prototype.html is already Claude's file; its assumptions become the starting ones of the next round.
    const next = buildRoundAdditions({ images: state.images, sent: [], previous: state.latest })
    if (next.ok) await writeFiles(workDir, next.additions.textFiles, [])
    deps.hub.broadcast({ type: 'prototypes', projectId })
  }
}

/** The Images the human adds in the conversation: checked against the 20 MB, numbered after every number used. */
function conversationImages({ record, workDir, state }: ScopeContext): ConversationImages {
  const additionsFor = (sent: ValidImage[]) => {
    const result = buildRoundAdditions({
      images: state.images,
      sent,
      previous: state.latest ?? { html: '', assumptions: [] },
    })
    if (!result.ok) throw new SessionError(result.reason)
    return result.additions
  }
  const asNumbered = (images: InputImage[]) =>
    images.map(({ number, mediaType, data }) => ({ number, mediaType, data }))
  return {
    number: (uploads) => {
      if (!uploads.length) return []
      const checked = parseMessageImages(uploads)
      if (!checked.ok) throw new SessionError(checked.reasons.map((reason) => reason.message).join(' '))
      return asNumbered(additionsFor(checked.images).newImages)
    },
    save: async (numbered): Promise<ImageRef[]> => {
      if (!numbered.length) return []
      const additions = additionsFor(numbered.map(({ mediaType, data }) => ({ mediaType, data })))
      // Before a first Prototype there is nothing to rewrite but the listing of the Images.
      const files = state.latest ? additions.textFiles : additions.textFiles.slice(0, 1)
      await writeFiles(workDir, files, additions.newImages)
      await saveGrillingImages(record.projectId, record.id, asNumbered(additions.newImages))
      state.images = additions.images
      return numbered.map(({ number, mediaType }) => ({ number, mediaType }))
    },
  }
}

function grillingScope(context: ScopeContext): Scope {
  const { record, workDir, state, deps } = context
  const { projectId } = record
  // The Supervisor hands a scope back the Transcript it was prepared with, which is this session's record.
  const own = (transcript: AnyTranscript) => transcript as PrototypeGrillingSession
  const announce = (transcript: AnyTranscript) =>
    deps.hub.broadcast({
      type: 'prototypeGrillingSession',
      projectId,
      session: prototypeGrillingSummaryOf(own(transcript)),
    })
  let announcedStep: PrototypeStep | undefined
  const stepOf = (transcript: AnyTranscript) => prototypeGrillingSummaryOf(own(transcript)).step
  const store = roundStore(context)
  return {
    cwd: workDir,
    guardMode: 'prototype',
    // Not --no-session-persistence (ADR-0024): the conversation can be continued.
    persist: true,
    rounds: true,
    conversationImages: conversationImages(context),
    stoppedNote: STOPPED_NOTE,
    save: (transcript) => savePrototypeGrillingSession(own(transcript)),
    emitMessage: (transcript, message) => {
      deps.hub.broadcast({ type: 'prototypeGrillingMessage', projectId, sessionId: transcript.id, message })
      // The running row follows Claude's step; it is announced only when the step changes.
      const step = stepOf(transcript)
      if (step === announcedStep) return
      announcedStep = step
      announce(transcript)
    },
    emitSession: (transcript) => {
      announcedStep = stepOf(transcript)
      announce(transcript)
      deps.hub.broadcast({ type: 'prototypes', projectId })
    },
    // The Image map is read at each submit: Images the human adds in the conversation are part of it.
    submit: (payload) => prototypeSubmitter({ sessionDir: workDir, images: state.images, store })(payload),
    submitLabel: PROTOTYPE_SUBMIT_LABEL,
    release: () => fs.rm(workDir, { recursive: true, force: true }),
  }
}
