// The step a running Prototype shows (user story 64): what Claude is doing, read from the tool calls the session has
// already recorded. It is one of a fixed set, never text from Claude, so the browser words it.
import type { ChatMessage, PrototypeStep } from '#core/session/sessionTypes.ts'

import { PROTOTYPE_FILE } from './prototypeFiles.ts'

/** What the tool message of a submit command says; the Prototype scope labels the command with it. */
export const PROTOTYPE_SUBMIT_LABEL = 'Submitted the Prototype for validation'
/** How the note about a refused submission starts. */
export const SUBMISSION_REFUSED_PREFIX = 'Submission refused'

const READING_TOOLS = ['Read', 'Grep', 'Glob']
const EDITING_TOOLS = ['Edit', 'MultiEdit']
const WROTE_PROTOTYPE = `Wrote ${PROTOTYPE_FILE}`

/** The step one message stands for, or undefined when it says nothing about what Claude is doing. */
function stepOfMessage(message: ChatMessage): PrototypeStep | undefined {
  switch (message.role) {
    case 'tool':
      if (READING_TOOLS.includes(message.tool)) return 'reading'
      if (message.tool === 'Bash') return message.summary === PROTOTYPE_SUBMIT_LABEL ? 'submitted' : undefined
      if (message.summary !== WROTE_PROTOTYPE) return undefined
      if (message.tool === 'Write') return 'writing'
      return EDITING_TOOLS.includes(message.tool) ? 'editing' : undefined
    case 'system':
      return message.tone === 'error' && message.text.startsWith(SUBMISSION_REFUSED_PREFIX) ? 'fixing' : undefined
    case 'claude':
    case 'human':
      return undefined
    default: {
      const _exhaustive: never = message
      return _exhaustive
    }
  }
}

const READ_PROTOTYPE = `Read ${PROTOTYPE_FILE}`

/** Whether the message is a look at the page Claude is making: reading it back is part of writing or fixing it. */
function isReadOfPrototype(message: ChatMessage): boolean {
  return message.role === 'tool' && READING_TOOLS.includes(message.tool) && message.summary === READ_PROTOTYPE
}

/** Whether the message is Claude writing the page. */
function isWriteOfPrototype(message: ChatMessage): boolean {
  return message.role === 'tool' && message.summary === WROTE_PROTOTYPE
}

/**
 * The latest step the messages show; undefined until Claude has done something worth naming. Once Claude has written
 * the page, reading (the page back, or anything else) is not a step back to "reading".
 */
export function prototypeStepOf(messages: ChatMessage[]): PrototypeStep | undefined {
  const firstWrite = messages.findIndex(isWriteOfPrototype)
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    const step = stepOfMessage(message)
    if (step === 'reading' && (isReadOfPrototype(message) || (firstWrite >= 0 && i > firstWrite))) continue
    if (step) return step
  }
  return undefined
}
