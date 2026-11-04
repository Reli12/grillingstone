// What Prototype storage keeps and what the Prototype lists show (ADR-0023), as Zod schemas: what is read back from
// disk or from the API is unknown until one of these parses it. The row of a list is a discriminated union on `kind`.
import { z } from 'zod'

import { IMAGE_MEDIA_TYPES, type ImageMediaType } from '#core/session/images.ts'
import {
  type ChatMessage,
  LIVE_STATUSES,
  type PrototypeGrillingSessionSummary,
  type PrototypeSessionSummary,
  type PrototypeStep,
  type SessionStatus,
} from '#core/session/sessionTypes.ts'

import { prototypeStepOf, prototypeTurnStepOf } from './prototypeStep.ts'

const mediaType = z.enum(IMAGE_MEDIA_TYPES)
const imageNumber = z.number().int().min(1)

const assumptionSchema = z.object({ choice: z.string(), why: z.string() })

/** An Image a Prototype shows, by its number in the session, with where it came from. */
const prototypeImageSchema = z.object({ number: imageNumber, mediaType, source: z.string() })

/** The two kinds of session that write Prototypes; they share one lock per Draft. */
export const PROTOTYPE_WRITER_KINDS = ['prototype', 'prototypeGrilling'] as const
export type PrototypeWriterKind = (typeof PROTOTYPE_WRITER_KINDS)[number]

/** The Draft a Prototype illustrates and the version it was built from: both, or no link at all. */
const draftLinkSchema = z.object({
  draftId: z.string(),
  /** The Draft version it was built from, which may be older than the Draft now. */
  draftVersion: z.number().int().min(1),
})
export type PrototypeDraftLink = z.infer<typeof draftLinkSchema>

/** Who wrote a Prototype: a Prototype Session, or a round of a Prototype Grilling Session. */
const writtenBySchema = z.discriminatedUnion('kind', [
  // Records from before sessions were recorded have no session id.
  z.object({ kind: z.literal('prototype'), sessionId: z.string().optional() }),
  z.object({ kind: z.literal('prototypeGrilling'), sessionId: z.string(), round: z.number().int().min(1) }),
]) satisfies z.ZodType<{ kind: PrototypeWriterKind }>
export type PrototypeWrittenBy = z.infer<typeof writtenBySchema>

const storedPrototypeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  /** Absent for a Prototype that illustrates no Draft. */
  draft: draftLinkSchema.optional(),
  writtenBy: writtenBySchema,
  writtenAt: z.string(),
  /** The earlier Prototype it started from; that Prototype may have been deleted since. */
  startingPrototypeId: z.string().optional(),
  /** The Images inlined into the page, by their number in the session that wrote it. */
  images: z.array(prototypeImageSchema),
  assumptions: z.array(assumptionSchema),
})

/**
 * Records written before Prototype Grilling Sessions keep the Draft as two flat fields and name no writer: they move
 * into `draft` and read as written by a Prototype Session. Only one of the two flat fields is left as it is, so that
 * the record is refused rather than read as having no Draft.
 */
function upgradeOlderRecord(stored: unknown): unknown {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return stored
  const { draftId, draftVersion, ...rest }: Record<string, unknown> = { ...stored }
  const flatDraft = draftId !== undefined || draftVersion !== undefined
  const withDraft = flatDraft && !('draft' in rest) ? { ...rest, draft: { draftId, draftVersion } } : rest
  return 'writtenBy' in withDraft ? withDraft : { ...withDraft, writtenBy: { kind: 'prototype' } }
}

/** prototypes/<id>.json: everything about a stored Prototype except its two HTML files. */
export const prototypeSchema = z.preprocess(upgradeOlderRecord, storedPrototypeSchema)
export type Prototype = z.infer<typeof storedPrototypeSchema>

const statusSchema = z.enum([
  'starting',
  'thinking',
  'waiting',
  'writing',
  'finished',
  'stopped',
  'failed',
  'interrupted',
]) satisfies z.ZodType<SessionStatus>

/** An Image of a Grilling Session of the Draft, picked on the start form. */
export const tickedImageSchema = z.object({ sessionId: z.string(), number: imageNumber })
export type TickedImage = z.infer<typeof tickedImageSchema>

/** An Image of one of the Draft's Grilling Sessions as the start form lists it, thumbnail and size included. */
export interface DraftImage extends TickedImage {
  mediaType: ImageMediaType
  /** Its size on disk: what it adds to the 20 MB of a session's Images. */
  bytes: number
  /** When the Grilling Session it was shown in started. */
  startedAt: string
}

/** What the human gave a session at the start, kept so 'Try again' can refill the form. */
export const prototypeInputsSchema = z.object({
  tickedImages: z.array(tickedImageSchema),
  /** The Images added on the start form; their bytes are copies kept beside the record. */
  extraImages: z.array(z.object({ number: imageNumber, mediaType })),
  startingPrototypeId: z.string().optional(),
})
export type PrototypeInputsRecord = z.infer<typeof prototypeInputsSchema>

// The messages are written by the Supervisor in its own shape; checking each field again here would only restate it.
const chatMessageSchema = z.custom<ChatMessage>((value) => typeof value === 'object' && value !== null)

/** The fields a Prototype Session's record and its summary share. */
const sessionBaseSchema = z.object({
  id: z.string(),
  kind: z.literal('prototype'),
  projectId: z.string(),
  draftId: z.string(),
  draftVersion: z.number().int().min(1),
  status: statusSchema,
  startedAt: z.string(),
  endedAt: z.string().optional(),
  error: z.string().optional(),
  prototypeId: z.string().optional(),
})

/** prototype-sessions/<id>.json: the record of one Prototype Session, kept until it is dismissed or the Draft is deleted. */
export const prototypeSessionSchema = sessionBaseSchema.extend({
  /** Always true: the session machine wants a confirmed write before it accepts a submission, and nobody confirms. */
  writeConfirmed: z.boolean(),
  claudeSessionId: z.string().optional(),
  inputs: prototypeInputsSchema,
  messages: z.array(chatMessageSchema),
})
export type PrototypeSession = z.infer<typeof prototypeSessionSchema>

const stepSchema = z.enum(['reading', 'writing', 'editing', 'submitted', 'fixing']) satisfies z.ZodType<PrototypeStep>

/** The record without its messages and inputs: what lists and live events send. A live one carries Claude's step. */
export function prototypeSummaryOf(session: PrototypeSession): PrototypeSessionSummary {
  const { id, kind, projectId, draftId, draftVersion, status, startedAt, endedAt, error, prototypeId } = session
  const step = LIVE_STATUSES.includes(status) ? prototypeStepOf(session.messages) : undefined
  return {
    id,
    kind,
    projectId,
    draftId,
    draftVersion,
    status,
    startedAt,
    ...(endedAt ? { endedAt } : {}),
    ...(error ? { error } : {}),
    ...(session.inputs.startingPrototypeId ? { startingPrototypeId: session.inputs.startingPrototypeId } : {}),
    ...(prototypeId ? { prototypeId } : {}),
    ...(step ? { step } : {}),
  }
}

const sessionSummarySchema = sessionBaseSchema.extend({
  startingPrototypeId: z.string().optional(),
  step: stepSchema.optional(),
}) satisfies z.ZodType<PrototypeSessionSummary>

/** The fields a Prototype Grilling Session's record and its summary share. */
const grillingBaseSchema = z.object({
  id: z.string(),
  kind: z.literal('prototypeGrilling'),
  projectId: z.string(),
  /** The Draft it started from and that Draft's version then; absent for a session that started from none. */
  draft: draftLinkSchema.optional(),
  status: statusSchema,
  startedAt: z.string(),
  endedAt: z.string().optional(),
  error: z.string().optional(),
  /** The ended session this one continues. */
  continues: z.string().optional(),
  /** The Prototypes it wrote, oldest round first. */
  prototypeIds: z.array(z.string()),
})

/**
 * prototype-grilling-sessions/<id>.json: the record of one Prototype Grilling Session. Unlike a Prototype Session's it
 * is not dismissed: it lives until the human deletes it or its Draft is deleted.
 */
export const prototypeGrillingSessionSchema = grillingBaseSchema.extend({
  /** True once the human confirmed the Ready Check (or asked Claude to write); the first Prototype waits for it. */
  writeConfirmed: z.boolean(),
  claudeSessionId: z.string().optional(),
  /** The first session of the chain of Continuations; its id names the working folder all of them share. */
  chainId: z.string().optional(),
  /** The rounds the chain's earlier sessions wrote, so a Continuation's rounds go on counting. */
  priorRounds: z.number().int().min(0).optional(),
  inputs: prototypeInputsSchema,
  messages: z.array(chatMessageSchema),
})
export type PrototypeGrillingSession = z.infer<typeof prototypeGrillingSessionSchema>

/** Claude's step, only while it works on a turn; "reading the Draft" is not said of a session that has no Draft. */
function grillingStepOf(session: PrototypeGrillingSession): PrototypeStep | undefined {
  if (session.status !== 'thinking' && session.status !== 'writing') return undefined
  const step = prototypeTurnStepOf(session.messages)
  return step === 'reading' && !session.draft ? undefined : step
}

/** The id that names the working folder of every session of a chain of Continuations: the first session's. */
export const workFolderIdOf = (session: Pick<PrototypeGrillingSession, 'id' | 'chainId'>) =>
  session.chainId ?? session.id

/** The round the session's next Prototype is: after the rounds the chain's earlier sessions wrote and its own. */
export const nextRoundOf = (session: Pick<PrototypeGrillingSession, 'prototypeIds' | 'priorRounds'>) =>
  (session.priorRounds ?? 0) + session.prototypeIds.length + 1

/** What a Continuation of the session inherits: its chain, and how many rounds the chain has written so far. */
export const chainOfContinuation = (earlier: PrototypeGrillingSession) => ({
  chainId: workFolderIdOf(earlier),
  priorRounds: (earlier.priorRounds ?? 0) + earlier.prototypeIds.length,
})

/** The record without its messages and inputs: what lists and live events send. A live one carries Claude's step. */
export function prototypeGrillingSummaryOf(session: PrototypeGrillingSession): PrototypeGrillingSessionSummary {
  const { id, kind, projectId, draft, status, startedAt, endedAt, error, continues, prototypeIds } = session
  const step = grillingStepOf(session)
  return {
    id,
    kind,
    projectId,
    ...(draft ? { draft } : {}),
    status,
    startedAt,
    ...(endedAt ? { endedAt } : {}),
    ...(error ? { error } : {}),
    ...(continues ? { continues } : {}),
    ...(session.inputs.startingPrototypeId ? { startingPrototypeId: session.inputs.startingPrototypeId } : {}),
    prototypeIds,
    ...(step ? { step } : {}),
  }
}

const grillingSummarySchema = grillingBaseSchema.extend({
  startingPrototypeId: z.string().optional(),
  step: stepSchema.optional(),
}) satisfies z.ZodType<PrototypeGrillingSessionSummary>

/** One row of a Prototypes list: a session in progress or ended without a Prototype, or a finished Prototype. */
export const prototypeRowSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('running'), session: sessionSummarySchema }),
  /** A Prototype Grilling Session that is live. Once it ends, its Prototypes are its rows. */
  z.object({ kind: z.literal('runningGrilling'), session: grillingSummarySchema }),
  /** A Prototype Grilling Session that ended without writing a Prototype: its page is still reachable from here. */
  z.object({ kind: z.literal('endedGrilling'), session: grillingSummarySchema }),
  /** A Failed row carries Claude's last messages, for its Details. */
  z.object({ kind: z.literal('failed'), session: sessionSummarySchema, messages: z.array(chatMessageSchema) }),
  z.object({ kind: z.literal('stopped'), session: sessionSummarySchema }),
  z.object({ kind: z.literal('finished'), prototype: prototypeSchema }),
])
export type PrototypeRow = z.infer<typeof prototypeRowSchema>

type RowWithTime = { row: PrototypeRow; at: string }

/** The row a session shows as, or null when it shows as its Prototype (finished) instead. */
function sessionRow(session: PrototypeSession): PrototypeRow | null {
  const summary = prototypeSummaryOf(session)
  if (LIVE_STATUSES.includes(session.status)) return { kind: 'running', session: summary }
  switch (session.status) {
    case 'stopped':
      return { kind: 'stopped', session: summary }
    case 'failed':
    case 'interrupted':
      return { kind: 'failed', session: summary, messages: session.messages }
    default:
      return null
  }
}

/** The rows of a list, newest first: every Prototype, and every session that is running, Failed or Stopped. */
export function prototypeRows(
  prototypes: Prototype[],
  sessions: PrototypeSession[],
  grillingSessions: PrototypeGrillingSession[] = [],
): PrototypeRow[] {
  const fromPrototypes = prototypes.map((prototype): RowWithTime => ({
    row: { kind: 'finished', prototype },
    at: prototype.writtenAt,
  }))
  const fromSessions = sessions.flatMap((session): RowWithTime[] => {
    const row = sessionRow(session)
    return row ? [{ row, at: session.startedAt }] : []
  })
  // A live session is a row; an ended one is its Prototypes, or a row of its own when it wrote none.
  const fromGrilling = grillingSessions.flatMap((session): RowWithTime[] => {
    const summary = prototypeGrillingSummaryOf(session)
    const at = session.startedAt
    if (LIVE_STATUSES.includes(session.status)) return [{ row: { kind: 'runningGrilling', session: summary }, at }]
    if (session.prototypeIds.length === 0) return [{ row: { kind: 'endedGrilling', session: summary }, at }]
    return []
  })
  return [...fromPrototypes, ...fromSessions, ...fromGrilling]
    .sort((first, second) => second.at.localeCompare(first.at))
    .map(({ row }) => row)
}
