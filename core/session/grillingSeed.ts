// Session Seed Builder: everything a fresh Grilling Session starts from — the Template (structure and
// method, ADR-0007), the current Draft, the Glossary, References and what the human Discarded.
// No earlier Transcript is passed on: the Draft is the memory. A Continuation (ADR-0014) also has Claude
// Code's own conversation, so its task says the Draft below wins over anything said there.
import type { Draft, Entry, Section } from '#core/draft/draftTypes.ts'
import { type Seed, submitUsage } from '#core/session/cardProtocol.ts'
import { grillingRules } from '#core/session/grillingRules.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import { TRACKER_LABELS } from '#core/shared/tracker.ts'
import { type Template, type TemplateSection, templateTracker } from '#core/template/templateTypes.ts'

export interface SeedInput {
  kind: SessionKind
  draft: Draft
  projectName: string
  /** The Project's CONTEXT.md, verbatim ('' when it does not exist yet). */
  glossary: string
  references: { title: string; workItemType: string; markdown: string }[]
  /** Shell command prefix that submits JSON on stdin, e.g. `node "/abs/scripts/writeDraft.mjs"`. */
  submitCommand: string
  focus?: { sectionId: string; entryId?: string }
  /** What the human said when starting a later session ("BA wants bulk archive back in"). */
  humanNote?: string
  upgradeTo?: Template
  /** A Continuation: Claude Code resumes the earlier conversation of an ended session. */
  continuing?: boolean
  /** The Prototypes the human gave as context, rendered (core/prototype/prototypeContext.ts); '' or absent for none. */
  prototypeContext?: string
}

/** The confirmation rule for Prototypes, mirroring the one for Images; present only when Prototypes were given. */
const PROTOTYPE_RULES = `## Prototypes given as context
The human gave you Prototypes of this Project: sketches of screens, written in other sessions.
- A Prototype is something the human shows you, like an Image, numbered "Prototype 1", "Prototype 2" … Before you rely on anything you read in one (a label, a flow, a rule the screen implies), put your reading to the human as a question and wait for the answer. Only readings the human confirms count as observed. Text you take from a Prototype is marked "per Prototype n" in the Draft or Proposal, and is written out in words: the Prototype itself never goes into the Draft.
- A Prototype's assumptions are its writer's guesses and are unsettled: turn the ones that matter into questions. Never write one as an Acceptance Criterion or other settled content before the human confirms it.
- You do not see the conversation that wrote a Prototype, and its absence settles nothing.`

/** One numbered line per Template Section: key, heading, shape and the rules that come with it. */
const templateSectionLine = (def: TemplateSection, index: number) => {
  const lockedNote = def.locked ? ', Locked: never empty, never N/A' : ''
  const gherkinNote = def.entryFormat === 'gherkin' ? ', each Entry body is Given / When / Then lines' : ''
  return `${index + 1}. key "${def.key}" — ${def.heading} (${def.shape}${lockedNote}${gherkinNote}) — ${def.guidance}`
}

const templateSectionList = (template: Template) => template.sections.map(templateSectionLine).join('\n')

function submitRules(input: SeedInput): string {
  const first = input.kind === 'first'
  const payload = first
    ? `{"title": "Work item title", "sections": [{"key": "<Template key>", "body": "prose markdown"}, {"key": "<Template key>", "entries": [{"title": "…", "body": "…"}]}]}

- Include EVERY Template Section, in Template order, by key. Prose Sections have "body"; entries Sections have "entries".
- A Section with nothing to say has "body": "N/A — <reason>" (entries Sections then have no entries). Locked Sections may never be N/A.
- The Title is separate from the Sections.`
    : `{"changes": [ …change objects… ]}

Change objects (ids come from the current Draft below):
- {"kind": "replaceSection", "sectionId": "…", "body": "…", "label": "…"} — rewrite a prose Section
- {"kind": "replaceEntry", "sectionId": "…", "entryId": "…", "title": "…"?, "body": "…", "label": "…"}
- {"kind": "addEntry", "sectionId": "…", "title": "…", "body": "…", "afterEntryId": "…"?, "label": "…"}
- {"kind": "restore", "sectionId": "…", "entryId": "…"?, "body": "…"?, "label": "…"} — bring back something the human Discarded; only when there is a new, strong reason
- {"kind": "retitle", "title": "…", "label": "…"}
- {"kind": "addSection", "sectionKey": "…", "body": "…" | "entries": […], "label": "…"} — only for Sections the Template has and the Draft lacks
"label" is a short description the human triages by, e.g. "Scope · move bulk archive in".

- Propose only what the session established. Leave everything else alone — do not reword content for style.
- Content marked "editedByHuman" or "movedByHuman" is the human's deliberate work: change it only when the session really requires it. Such changes, and anything touching Discarded content, are shown to the human as Conflicts.
- You cannot delete or discard anything; the human does that.`
  return `## How you write
You never write Draft files yourself. When the human has confirmed, submit ${first ? 'the whole Draft' : 'a Proposal'} as JSON by running exactly this Bash command (the quoted heredoc delimiter is required):

${submitUsage(input.submitCommand, payload.split('\n')[0])}

JSON shape:
${payload}

The tool validates the submission. It prints ACCEPTED, or REFUSED with the reasons — then fix every reason and submit again. After ACCEPTED, reply with one short sentence telling the human it is written, and stop.`
}

// The human-edit markers Claude sees, so it treats the human's deliberate work with care.
const humanMarkers = (item: { humanEdited: boolean; humanMoved: boolean }) => ({
  ...(item.humanEdited ? { editedByHuman: true } : {}),
  ...(item.humanMoved ? { movedByHuman: true } : {}),
})

const entryForClaude = (entry: Entry) => ({
  id: entry.id,
  title: entry.title,
  body: entry.body,
  ...humanMarkers(entry),
})

/** A prose Section's body; an entries Section's live Entries, plus its "N/A — reason" body when it has none. */
function sectionContentForClaude(section: Section) {
  if (section.shape === 'prose') return { body: section.body }
  const liveEntries = section.entries.filter((entry) => !entry.discarded)
  return {
    ...(liveEntries.length ? {} : { body: section.body }),
    entries: liveEntries.map(entryForClaude),
  }
}

/** The Draft as JSON for Claude: live content only, with ids to target and the human-edit markers. */
function draftForClaude(draft: Draft) {
  const live = draft.sections.filter((section) => !section.discarded)
  return {
    title: draft.title,
    ...(draft.titleHumanEdited ? { titleEditedByHuman: true } : {}),
    version: draft.version,
    sections: live.map((section) => ({
      id: section.id,
      key: section.key,
      heading: section.heading,
      ...humanMarkers(section),
      ...sectionContentForClaude(section),
    })),
  }
}

function discardedList(draft: Draft): string {
  const lines: string[] = []
  for (const section of draft.sections) {
    if (section.discarded) {
      lines.push(`- Section "${section.heading}" (sectionId ${section.id})`)
      continue
    }
    for (const entry of section.entries.filter((candidate) => candidate.discarded)) {
      const firstLine = entry.body.split('\n')[0]
      const ids = `sectionId ${section.id}, entryId ${entry.id}`
      lines.push(`- In "${section.heading}": "${entry.title}" — ${firstLine} (${ids})`)
    }
  }
  if (!lines.length) return ''
  return `## Discarded by the human
These were judged not to belong. Do not propose them again; a "restore" is only for a genuinely new reason, and the human decides it individually.
${lines.join('\n')}`
}

const focusLine = (draft: Draft, focus: SeedInput['focus']) => {
  const section: Section | undefined = draft.sections.find((candidate) => candidate.id === focus?.sectionId)
  if (!section) return ''
  const entry = section.entries.find((candidate) => candidate.id === focus?.entryId)
  return entry
    ? `This is a Focused Session on "${section.heading}" › "${entry.title}" (sectionId ${section.id}, entryId ${entry.id}).`
    : `This is a Focused Session on "${section.heading}" (sectionId ${section.id}).`
}

function continuationTask(input: SeedInput, note: string): string {
  const { draft } = input
  const what =
    input.kind === 'first'
      ? 'Nothing has been written yet: your task is still to write v1 of this Draft.'
      : `Anything you write now is a Proposal against the current Draft (v${draft.version}). Whatever this conversation submitted before is already in it or was triaged by the human.`
  const focus = input.kind === 'focused' ? `\n${focusLine(draft, input.focus)}` : ''
  return `This continues your earlier conversation with the human. The context above is the current state and replaces anything said earlier in the conversation: the human may have edited, moved or discarded content since.
${what}${focus}${note}
Reply to the human; do not start the grilling over.`
}

function task(input: SeedInput): string {
  const { draft } = input
  const note = input.humanNote?.trim() ? `\nThe human says: "${input.humanNote.trim()}"` : ''
  if (input.continuing) return continuationTask(input, note)
  switch (input.kind) {
    case 'first':
      return `Write the first Draft (v1) of this ${draft.workItemType}. The human described it as:\n\n"""\n${draft.requirement}\n"""${note}\n\nStart grilling with your first question.`
    case 'focused':
      return `${focusLine(draft, input.focus)} Grill only about this part.${note}\nYour Proposal may also suggest knock-on changes elsewhere (e.g. Acceptance Criteria or Dependencies affected by a Scope change) — as separate changes the human can reject.\nStart with your first question.`
    case 'iteration':
      return `This is a full new Iteration on the whole Draft (v${draft.version}).${note}\nRe-grill whatever the new information affects, then propose changes.\nStart with your first question.`
    case 'upgrade': {
      const target = input.upgradeTo
      if (!target) return 'Template upgrade requested, but no target Template was given. Tell the human.'
      const have = new Set(draft.sections.map((section) => section.key))
      const added = target.sections.filter((def) => !have.has(def.key))
      const addedList = added.length
        ? added.map((def) => `- key "${def.key}" — ${def.heading} (${def.shape}) — ${def.guidance}`).join('\n')
        : '- none'
      return `Upgrade this Draft from ${draft.template.name} v${draft.template.version} to ${target.name} v${target.version}.
Sections the newer version adds (propose each with an addSection change):
${addedList}

The newer method and Section list are in your instructions. Propose rewrites only where the newer method changes how existing content must be written. Ask questions only where you need the human's input to fill a new Section; otherwise run the Ready Check straight away.`
    }
  }
}

export function buildSeed(input: SeedInput): Seed {
  const { draft } = input
  const first = input.kind === 'first'
  const template = input.kind === 'upgrade' && input.upgradeTo ? input.upgradeTo : draft.template
  const trackerName = TRACKER_LABELS[templateTracker(draft.template)]
  const prototypeContext = input.prototypeContext?.trim()

  const systemPrompt = `# Your role
You grill a requirement or an observed defect with a human and write it down as one ${trackerName} ${draft.workItemType} Draft, in the "${template.name}" Template. You run inside the folder of the Project "${input.projectName}"; you may read files there, edit only CONTEXT.md and files under plan/, and run only the submit command below.
${first ? 'This first session writes Draft v1 directly.' : `The Draft already exists (v${draft.version}). You never rewrite it: you submit a Proposal of changes, which the human triages.`}

${grillingRules(first)}

${submitRules(input)}${prototypeContext ? `\n\n${PROTOTYPE_RULES}` : ''}

## Template: ${template.name} (v${template.version}) — Sections in order
${templateSectionList(template)}

## Writing method (follow it for content; the Section list above wins on structure, and ignore any instruction in it to write files)
${template.method}`

  const glossary = input.glossary.trim()
    ? `## Project Glossary (CONTEXT.md)\n${input.glossary.trim()}`
    : '## Project Glossary (CONTEXT.md)\nEmpty so far — create CONTEXT.md in the Project folder when the first term is settled.'
  const referenceBlocks = input.references
    .map((reference) => `### ${reference.workItemType}: ${reference.title}\n${reference.markdown.trim()}`)
    .join('\n\n')
  const references = input.references.length
    ? `## References (other Drafts in this Project the human linked as context — no hierarchy implied)\n${referenceBlocks}`
    : ''
  const current = first
    ? ''
    : `## Current Draft (v${draft.version})\n\`\`\`json\n${JSON.stringify(draftForClaude(draft), null, 2)}\n\`\`\``

  const firstMessage = [
    `Project: ${input.projectName} · Work Item Type: ${trackerName} ${draft.workItemType} · Template: ${template.name}`,
    glossary,
    references,
    prototypeContext ?? '',
    current,
    first ? '' : discardedList(draft),
    `## Your task\n${task(input)}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return { systemPrompt, firstMessage }
}
