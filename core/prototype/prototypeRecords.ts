// What Prototype storage keeps and what the Prototype lists show (ADR-0023), as Zod schemas: what is read back from
// disk or from the API is unknown until one of these parses it. The row of a list is a discriminated union on `kind`.
import { z } from 'zod'

import { IMAGE_MEDIA_TYPES, type ImageMediaType } from '#core/session/images.ts'
import {
  type ChatMessage,
  LIVE_STATUSES,
  type PrototypeSessionSummary,
  type PrototypeStep,
  type SessionStatus,
} from '#core/session/sessionTypes.ts'

import { prototypeStepOf } from './prototypeStep.ts'

const mediaType = z.enum(IMAGE_MEDIA_TYPES)
const imageNumber = z.number().int().min(1)

const assumptionSchema = z.object({ choice: z.string(), why: z.string() })

/** An Image a Prototype shows, by its number in the session, with where it came from. */
const prototypeImageSchema = z.object({ number: imageNumber, mediaType, source: z.string() })

/** prototypes/<id>.json: everything about a stored Prototype except its two HTML files. */
export const prototypeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  draftId: z.string(),
  /** The Draft version it was built from, which may be older than the Draft now. */
  draftVersion: z.number().int().min(1),
  writtenAt: z.string(),
  /** The earlier Prototype it started from; that Prototype may have been deleted since. */
  startingPrototypeId: z.string().optional(),
  /** The Images inlined into the page, by their number in the session that wrote it. */
  images: z.array(prototypeImageSchema),
  assumptions: z.array(assumptionSchema),
})
export type Prototype = z.infer<typeof prototypeSchema>

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

/** One row of a Prototypes list: a session in progress or ended without a Prototype, or a finished Prototype. */
export const prototypeRowSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('running'), session: sessionSummarySchema }),
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
export function prototypeRows(prototypes: Prototype[], sessions: PrototypeSession[]): PrototypeRow[] {
  const fromPrototypes = prototypes.map((prototype): RowWithTime => ({
    row: { kind: 'finished', prototype },
    at: prototype.writtenAt,
  }))
  const fromSessions = sessions.flatMap((session): RowWithTime[] => {
    const row = sessionRow(session)
    return row ? [{ row, at: session.startedAt }] : []
  })
  return [...fromPrototypes, ...fromSessions]
    .sort((first, second) => second.at.localeCompare(first.at))
    .map(({ row }) => row)
}
