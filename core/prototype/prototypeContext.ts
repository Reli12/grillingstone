// Prototype context for a Grilling Session (pure): what a session given Prototypes of its Project may read. Each
// Prototype's HTML source, its assumptions under a heading that marks them unsettled, and its Images numbered after
// the session's own. Never the conversation of the session that wrote it: the input has no place for one.
import type { PrototypeAssumption } from '#core/prototype/prototypeAssembly.ts'
import type { NumberedImage, ValidImage } from '#core/session/images.ts'

/** An Image a Prototype shows, by the number its own source uses, and where it came from. */
export interface ContextImage extends ValidImage {
  number: number
  source: string
}

export interface ContextPrototype {
  kind: 'prototype'
  id: string
  writtenAt: string
  /** The Draft version it was built from; absent for a Prototype of no Draft. */
  draftVersion?: number
  /** Claude's file as submitted, with `images/N` in the numbering of the session that wrote it. */
  html: string
  assumptions: PrototypeAssumption[]
  images: ContextImage[]
}

/** A Prototype the human gave that has been deleted since. */
export interface DeletedContextPrototype {
  kind: 'deleted'
  id: string
}

export type ContextEntry = ContextPrototype | DeletedContextPrototype

export interface PrototypeContextRequest {
  /** In the order given; the position is the Prototype's number here. */
  entries: ContextEntry[]
  /** The first Image number nobody in the session uses. */
  firstImageNumber: number
}

export interface PrototypeContext {
  /** '' when no Prototype was given. */
  markdown: string
  /** The Images as image blocks for Claude's first message, in the session's numbering. */
  images: NumberedImage[]
}

const BACKTICK_RUN = /`+/g

/** A code fence longer than any run of backticks in the source, so the source cannot end it early. */
function fenceFor(source: string): string {
  const longest = Math.max(0, ...(source.match(BACKTICK_RUN) ?? []).map((run) => run.length))
  return '`'.repeat(Math.max(3, longest + 1))
}

function assumptionsBlock(assumptions: PrototypeAssumption[]): string {
  const heading = '#### Assumptions (unsettled: questions to ask, not decisions)'
  if (!assumptions.length) return `${heading}\nThis Prototype lists no assumptions.`
  const lines = assumptions.map((assumption) => `- ${assumption.choice}: ${assumption.why}`)
  return `${heading}\n${lines.join('\n')}`
}

function imagesBlock(shown: Array<ContextImage & { sessionNumber: number }>): string {
  if (!shown.length) return ''
  const lines = shown.map((image) => `- images/${image.number} is Image ${image.sessionNumber} (${image.source}).`)
  return `#### Images this Prototype shows\nIn the source below, an Image is written images/N; in this session it has the number given here.\n${lines.join('\n')}`
}

const HEADING =
  '## Prototypes (sketches of this Project the human gave you as context; nothing in them counts until the human confirms it)'

export function buildPrototypeContext({ entries, firstImageNumber }: PrototypeContextRequest): PrototypeContext {
  if (!entries.length) return { markdown: '', images: [] }
  let next = firstImageNumber
  const images: NumberedImage[] = []
  const blocks = entries.map((entry, index) => {
    const position = index + 1
    if (entry.kind === 'deleted') return `Prototype ${position} was deleted and is left out.`
    const shown = entry.images.map((image) => {
      const sessionNumber = next++
      images.push({ number: sessionNumber, mediaType: image.mediaType, data: image.data })
      return { ...image, sessionNumber }
    })
    const built = entry.draftVersion === undefined ? 'built from no Draft' : `built from Draft v${entry.draftVersion}`
    const fence = fenceFor(entry.html)
    return [
      `### Prototype ${position} (written ${entry.writtenAt.slice(0, 10)}, ${built})`,
      assumptionsBlock(entry.assumptions),
      imagesBlock(shown),
      `#### Source\n${fence}html\n${entry.html}\n${fence}`,
    ]
      .filter(Boolean)
      .join('\n\n')
  })
  return { markdown: [HEADING, ...blocks].join('\n\n'), images }
}
