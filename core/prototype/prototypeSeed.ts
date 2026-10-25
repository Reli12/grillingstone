// Prototype seed: what a Prototype Session starts from. It states the job and its limits; the Draft, the Glossary
// and the Images are files in the session folder (see prototypeInputs.ts), and the first message points at them.
import {
  DRAFT_FILE,
  GLOSSARY_FILE,
  IMAGES_FILE,
  PROTOTYPE_FILE,
  START_ASSUMPTIONS_FILE,
} from '#core/prototype/prototypeFiles.ts'
import { type Seed, submitUsage } from '#core/session/cardProtocol.ts'

export interface PrototypeSeedInput {
  projectName: string
  draftTitle: string
  draftVersion: number
  /** Whether Claude's first message carries image blocks. */
  hasImages: boolean
  hasStartingPrototype: boolean
  /** Shell command prefix that submits JSON on stdin, e.g. `node "/abs/scripts/writeDraft.mjs"`. */
  submitCommand: string
}

const ROLE = `# Your role
You run a Prototype Session: in a single turn you write one interactive HTML Prototype of the work item Draft you are given, so a human can click through what the Draft describes.
- You never ask the human anything and nobody answers: decide, and list every guess as an assumption.
- You never write anything but ${PROTOTYPE_FILE}. You never change the Draft, the Glossary or anything else.
- Your working folder holds the Draft (${DRAFT_FILE}), the Glossary (${GLOSSARY_FILE}) and the Images (${IMAGES_FILE} lists them). You may read any file there.`

const BUILD_RULES = `## How you build it
- Match the look of the Images of existing screens first: layout, colours, type, components. Where there is no Image to follow, keep it plain and neutral.
- Take wording from the Draft and the Glossary. Use the Glossary's terms exactly.
- Make the flow of each Acceptance Criterion in the Draft reachable by clicking, and its outcome visible on screen. Walk the Acceptance Criteria one by one.
- One self-contained HTML file: inline CSS in <style>, inline JavaScript in <script>. No external URLs, fonts or libraries, no <link>, <base> or <meta http-equiv="refresh">. Nothing may load from elsewhere and nothing is sent anywhere.
- Refer to an Image only as images/N, with the number from ${IMAGES_FILE} and without a file extension (<img src="images/2">, url(images/2)). Refer to places in the page only as #anchor.
- Make it work offline with sample data you invent. Do not build what the Draft does not describe.`

const ASSUMPTION_RULES = `## Assumptions
Every choice the Draft and the Images do not settle is an assumption, and you list each one: what you chose, and why it was a guess. These count: layout, sample data, wording that is not in the Draft or the Glossary, empty and error states, and navigation. A Prototype that lists none is refused.`

function submitRules(submitCommand: string): string {
  const firstLine = '{"prototype": "prototype.html", "assumptions": [{"choice": "…", "why": "…"}]}'
  return `## How you submit
Write the whole page to ${PROTOTYPE_FILE} with Write. Then submit it by running exactly this Bash command (the quoted heredoc delimiter is required):

${submitUsage(submitCommand, firstLine)}

The tool reads ${PROTOTYPE_FILE} from your folder; the JSON only names it and lists the assumptions. It prints ACCEPTED, or REFUSED with the reasons: fix every reason in ${PROTOTYPE_FILE} with Edit and submit again. After ACCEPTED, reply with one short sentence saying the Prototype is written, and stop.`
}

const STARTING_RULES = `## Starting from an earlier Prototype
${PROTOTYPE_FILE} already holds an earlier Prototype of this Draft, and ${START_ASSUMPTIONS_FILE} lists its assumptions.
- Edit the existing ${PROTOTYPE_FILE}; do not start over. Keep its structure and look, and update it to the Draft as it is now.
- Its Images are already renumbered to this session. Images marked "kept from the starting Prototype" in ${IMAGES_FILE} are files only: keep showing them where they were.
- Revise the assumptions: keep the assumptions that still hold, drop the ones the Draft now settles, and add the new ones.`

function firstMessage(input: PrototypeSeedInput): string {
  const files = [
    `- ${DRAFT_FILE}: the Draft, as it stands (only what the human kept)`,
    `- ${GLOSSARY_FILE}: the Project Glossary, for wording`,
    `- ${IMAGES_FILE}: the Images by number, and where each came from`,
    ...(input.hasStartingPrototype
      ? [`- ${PROTOTYPE_FILE}: the earlier Prototype to edit`, `- ${START_ASSUMPTIONS_FILE}: its assumptions`]
      : []),
  ].join('\n')
  const images = input.hasImages ? 'The Images follow as image blocks, each after its "Image n:" label.' : ''
  return [
    `Project: ${input.projectName} · Draft: ${input.draftTitle} (v${input.draftVersion})`,
    `## Your folder\n${files}`,
    images,
    `## Your task\nWrite the Prototype of Draft v${input.draftVersion} now, then submit it.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildPrototypeSeed(input: PrototypeSeedInput): Seed {
  const systemPrompt = [
    ROLE,
    BUILD_RULES,
    ASSUMPTION_RULES,
    ...(input.hasStartingPrototype ? [STARTING_RULES] : []),
    submitRules(input.submitCommand),
  ].join('\n\n')
  return { systemPrompt, firstMessage: firstMessage(input) }
}
