// The words a Prototype is named with: the Draft version it was built from and when it was written, and the short
// reason shown on a Failed row.
import type { PrototypeWrittenBy } from '#core/prototype/prototypeRecords.ts'
import type { ChatMessage, PrototypeStep } from '#core/session/sessionTypes.ts'

/** A line is cut here, so a long error from Claude Code stays a short reason. */
const MAX_REASON_LENGTH = 160
const NO_REASON = {
  prototype: 'The Prototype Session failed.',
  prototypeGrilling: 'The Prototype Grilling Session failed.',
} satisfies Record<'prototype' | 'prototypeGrilling', string>

const WHEN_FORMAT = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } as const

export const whenLabel = (iso: string) => new Date(iso).toLocaleString([], WHEN_FORMAT)

const pad = (value: number) => String(value).padStart(2, '0')

/** How long a Prototype has been written: "42s", "3m 05s", "1h 02m". Never below zero. */
export function elapsedLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${pad(minutes)}m`
  if (minutes > 0) return `${minutes}m ${pad(seconds % 60)}s`
  return `${seconds}s`
}

const STEP_LABELS = {
  reading: 'Reading the Draft',
  writing: 'Writing prototype.html',
  editing: 'Editing prototype.html',
  submitted: 'Submitted, checking it',
  fixing: 'Fixing what the check refused',
} satisfies Record<PrototypeStep, string>

/** Claude's latest step in words. */
export const stepLabel = (step: PrototypeStep) => STEP_LABELS[step]

/** "Draft v2, started 25 Oct 2026, 10:04": the line under an ended session's status. */
export const sessionDetail = ({ draftVersion, startedAt }: { draftVersion: number; startedAt: string }) =>
  `Draft v${draftVersion}, started ${whenLabel(startedAt)}`

/** What a Prototype of no Draft is labelled with where a Draft version would be. */
export const NO_DRAFT_LABEL = 'no Draft'

interface LabelledPrototype {
  draft?: { draftVersion: number }
  writtenAt: string
}

/** "v2 · 25 Oct 2026, 10:04": the Draft version a Prototype was built from (or "no Draft"), and when it was written. */
export const prototypeLabel = ({ draft, writtenAt }: LabelledPrototype) => {
  const version = draft ? `v${draft.draftVersion}` : NO_DRAFT_LABEL
  return `${version} · ${whenLabel(writtenAt)}`
}

/** "Starting Draft: Checkout flow, v2" (a Draft since deleted has no title), or "Starting Draft: none". */
export function startingDraftLabel(draft: { draftVersion: number } | undefined, title: string | undefined) {
  if (!draft) return 'Starting Draft: none'
  return `Starting Draft: ${title ?? 'a deleted Draft'}, v${draft.draftVersion}`
}

/** "Starting Prototype: v2 · 25 Oct 2026, 10:04", "…a deleted Prototype", or "…none". */
export function startingPrototypeLabel(
  startingPrototypeId: string | undefined,
  all: Array<LabelledPrototype & { id: string }>,
) {
  if (!startingPrototypeId) return 'Starting Prototype: none'
  const from = all.find((candidate) => candidate.id === startingPrototypeId)
  return `Starting Prototype: ${from ? prototypeLabel(from) : 'a deleted Prototype'}`
}

/** Which kind of session wrote a Prototype, so a row says whether there is a conversation behind it. */
export function writerLabel(writtenBy: PrototypeWrittenBy) {
  switch (writtenBy.kind) {
    case 'prototype':
      return 'Written by a Prototype Session'
    case 'prototypeGrilling':
      return `Written by a Prototype Grilling Session, round ${writtenBy.round}`
    default: {
      const _exhaustive: never = writtenBy
      return _exhaustive
    }
  }
}

/** "Round 2 · Draft v3": a version in a session's strip, by its round and, when it has one, its Draft version. */
export function roundLabel({ writtenBy, draft }: { writtenBy: PrototypeWrittenBy; draft?: { draftVersion: number } }) {
  const round = writtenBy.kind === 'prototypeGrilling' ? `Round ${writtenBy.round}` : 'Round 1'
  return draft ? `${round} · Draft v${draft.draftVersion}` : round
}

/** "started from v1 · 20 Oct 2026, 10:04", or "started from a deleted Prototype"; nothing if none was started from. */
export function startedFromLabel(
  prototype: { id: string; startingPrototypeId?: string },
  all: Array<LabelledPrototype & { id: string }>,
) {
  if (!prototype.startingPrototypeId) return undefined
  const from = all.find((candidate) => candidate.id === prototype.startingPrototypeId)
  return from ? `started from ${prototypeLabel(from)}` : 'started from a deleted Prototype'
}

/** "Created from Prototype v1 · 20 Oct 2026, 10:04", or "Created from a deleted Prototype"; nothing if not created from one. */
export function createdFromLabel(
  createdFromPrototypeId: string | undefined,
  all: Array<LabelledPrototype & { id: string }>,
) {
  if (!createdFromPrototypeId) return undefined
  const from = all.find((candidate) => candidate.id === createdFromPrototypeId)
  return from ? `Created from Prototype ${prototypeLabel(from)}` : 'Created from a deleted Prototype'
}

/** What a message says, as plain text; empty for one with nothing to read. */
function textOf(message: ChatMessage) {
  switch (message.role) {
    case 'claude':
      return message.segments.flatMap((segment) => (segment.type === 'text' ? [segment.text] : [])).join('\n')
    case 'tool':
      return `${message.tool}: ${message.summary}`
    case 'system':
    case 'human':
      return message.text
    default: {
      const _exhaustive: never = message
      return _exhaustive
    }
  }
}

/** Claude's last messages of a session as lines of text, for the Details of a Failed row. */
export function lastMessageLines(messages: ChatMessage[], count: number) {
  return messages
    .slice(-count)
    .map((message) => ({ id: message.id, text: textOf(message) }))
    .filter((line) => line.text.trim() !== '')
}

/** The first line of a session's error, cut short; a placeholder naming the kind of session when none was recorded. */
export function shortReason(error: string | undefined, kind: 'prototype' | 'prototypeGrilling' = 'prototype') {
  const firstLine = (error ?? '').trim().split('\n')[0].trim()
  if (!firstLine) return NO_REASON[kind]
  return firstLine.length > MAX_REASON_LENGTH ? `${firstLine.slice(0, MAX_REASON_LENGTH)}…` : firstLine
}
