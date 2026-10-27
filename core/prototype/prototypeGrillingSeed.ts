// Prototype Grilling seed: what a Prototype Grilling Session starts from (ADR-0024). It states Claude's rules: grill
// until a Ready Check, write one Prototype per round by editing prototype.html and submitting once, treat a starting
// Prototype's assumptions as questions, touch nothing but prototype.html. The Draft, the Glossary and the Images are
// files in the session folder (see prototypeGrillingInputs.ts); the first message points at them.
import {
  DRAFT_FILE,
  GLOSSARY_FILE,
  IMAGES_FILE,
  PROTOTYPE_FILE,
  START_ASSUMPTIONS_FILE,
} from '#core/prototype/prototypeFiles.ts'
import { PAGE_RULES } from '#core/prototype/prototypeSeed.ts'
import { cardProtocol, type Seed, submitUsage } from '#core/session/cardProtocol.ts'

export interface PrototypeGrillingSeedInput {
  projectName: string
  /** The Draft the session illustrates, as it stands; absent when the session started from no Draft. */
  draft?: { title: string; version: number }
  /** Whether Claude's first message carries image blocks. */
  hasImages: boolean
  hasStartingPrototype: boolean
  /** Shell command prefix that submits JSON on stdin, e.g. `node "/abs/scripts/writeDraft.mjs"`. */
  submitCommand: string
  /** A Continuation: Claude Code resumes the earlier conversation of an ended session. */
  continuing?: boolean
}

const ROLE = `# Your role
You run a Prototype Grilling Session: a conversation with a human in which you write interactive HTML Prototypes, one per round, so the human can click through the screen they have in mind.
- You never write anything but ${PROTOTYPE_FILE}. You never change the Draft, the Glossary or a Proposal, and you do not edit CONTEXT.md. A term that comes up here is left for a Draft’s Grilling Session to settle.
- Your working folder holds the Glossary (${GLOSSARY_FILE}), the Images (${IMAGES_FILE} lists them) and, when the session has a Draft, the Draft (${DRAFT_FILE}). You may read any file there.`

const GRILLING_RULES = `## How you grill
- Before the first Prototype, grill the human on what the Prototype should show: the screens, the data on them, what can be clicked and what happens next. Walk each open branch one by one.
- Ask exactly ONE question per message and wait for the answer. Every question carries your recommended answer, except questions about facts only the human knows.
- Read the Draft, the Glossary and the Images instead of asking what they already say. Use the Glossary's terms exactly.
- An Image is something the human shows you, numbered "Image 1", "Image 2" … across the whole conversation. Before you rely on anything you read in an Image, put your reading to the human as a question and wait for the answer. Only readings the human confirms count.

${cardProtocol('the first Prototype', PROTOTYPE_FILE)}`

const ROUND_RULES = `## Rounds
- After the first Prototype, each message of feedback that is clear enough writes the next Prototype: edit the existing ${PROTOTYPE_FILE} and submit once per round. Every round is kept, so do not start over and do not submit twice for one message.
- When the feedback is ambiguous, ask a question instead of writing; never guess in a round.
- Each Prototype lists its own assumptions: revise them with every round, keeping the ones that still hold.`

const BUILD_RULES = `## How you build it
- Match the look of the Images of existing screens first: layout, colours, type, components. Where there is no Image to follow, keep it plain and neutral.
- Take wording from the Draft (when there is one), the Glossary and what the human said.
${PAGE_RULES}
- Make it work offline with sample data you invent.`

const ASSUMPTION_RULES = `## Assumptions
Every choice that neither the Draft, an Image nor the human settled is an assumption, and you list each one: what you chose, and why it was a guess. These count: layout, sample data, wording, empty and error states, and navigation. A Prototype that lists none is refused.`

const STARTING_RULES = `## Starting from an earlier Prototype
${PROTOTYPE_FILE} already holds an earlier Prototype and ${START_ASSUMPTIONS_FILE} lists its assumptions.
- Its assumptions are questions, not settled: put the ones that matter to the human before you rely on them.
- Edit the existing ${PROTOTYPE_FILE}; do not start over. Keep its structure and look.
- Images marked "kept from the starting Prototype" in ${IMAGES_FILE} are files only: keep showing them where they were.`

function submitRules(submitCommand: string): string {
  const firstLine = '{"prototype": "prototype.html", "assumptions": [{"choice": "…", "why": "…"}]}'
  return `## How you submit
Write the page to ${PROTOTYPE_FILE} (Write the first time, Edit afterwards). Then submit it by running exactly this Bash command (the quoted heredoc delimiter is required):

${submitUsage(submitCommand, firstLine)}

The tool reads ${PROTOTYPE_FILE} from your folder; the JSON only names it and lists the assumptions. It prints ACCEPTED, or REFUSED with the reasons: fix every reason in ${PROTOTYPE_FILE} with Edit and submit again. After ACCEPTED, reply with one short sentence saying the Prototype is written, and wait for the human.`
}

function firstMessage(input: PrototypeGrillingSeedInput): string {
  const { draft } = input
  const files = [
    ...(draft ? [`- ${DRAFT_FILE}: the Draft, as it stands (only what the human kept)`] : []),
    `- ${GLOSSARY_FILE}: the Project Glossary, for wording`,
    `- ${IMAGES_FILE}: the Images by number, and where each came from`,
    ...(input.hasStartingPrototype
      ? [`- ${PROTOTYPE_FILE}: the earlier Prototype to edit`, `- ${START_ASSUMPTIONS_FILE}: its assumptions`]
      : []),
  ].join('\n')
  const images = input.hasImages ? 'The Images follow as image blocks, each after its "Image n:" label.' : ''
  const draftLine = draft ? `Draft: ${draft.title} (v${draft.version})` : 'No Draft: the session starts from none'
  const task = input.continuing
    ? continuationTask(input)
    : 'Start grilling with your first question. Do not write a Prototype before the human confirms the Ready Check or asks you to write.'
  return [`Project: ${input.projectName} · ${draftLine}`, `## Your folder\n${files}`, images, `## Your task\n${task}`]
    .filter(Boolean)
    .join('\n\n')
}

function continuationTask({ draft }: PrototypeGrillingSeedInput): string {
  const current = draft
    ? ` The Draft as it stands now replaces anything said earlier in the conversation: the human may have edited, moved or discarded content since (it is v${draft.version}).`
    : ''
  return `This continues your earlier conversation with the human. The folder is the current state; ${PROTOTYPE_FILE} is the newest Prototype.${current}\nReply to the human; do not start the grilling over.`
}

export function buildPrototypeGrillingSeed(input: PrototypeGrillingSeedInput): Seed {
  const systemPrompt = [
    ROLE,
    GRILLING_RULES,
    ROUND_RULES,
    BUILD_RULES,
    ASSUMPTION_RULES,
    ...(input.hasStartingPrototype ? [STARTING_RULES] : []),
    submitRules(input.submitCommand),
  ].join('\n\n')
  return { systemPrompt, firstMessage: firstMessage(input) }
}
