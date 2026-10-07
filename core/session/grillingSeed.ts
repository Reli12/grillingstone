// Session Seed Builder: everything a fresh Grilling Session starts from — the Template (structure and
// method, ADR-0007), the current Draft, the Glossary, References and what the human Discarded.
// No earlier Transcript is passed on: the Draft is the memory. A Continuation (ADR-0014) also has Claude
// Code's own conversation, so its task says the Draft below wins over anything said there.
import type { Draft, Section } from '#core/draft/draftTypes.ts'
import { submitUsage, type Seed } from '#core/session/cardProtocol.ts'
import { grillingRules } from '#core/session/grillingRules.ts'
import type { SessionKind } from '#core/session/sessionKind.ts'
import type { Template } from '#core/template/templateTypes.ts'

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
}

const templateSectionList = (t: Template) =>
  t.sections
    .map(
      (s, i) =>
        `${i + 1}. key "${s.key}" — ${s.heading} (${s.shape}${s.locked ? ', Locked: never empty, never N/A' : ''}${s.entryFormat === 'gherkin' ? ', each Entry body is Given / When / Then lines' : ''}) — ${s.guidance}`,
    )
    .join('\n')

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

function draftForClaude(draft: Draft) {
  const live = draft.sections.filter((s) => !s.discarded)
  return {
    title: draft.title,
    ...(draft.titleHumanEdited ? { titleEditedByHuman: true } : {}),
    version: draft.version,
    sections: live.map((s) => ({
      id: s.id,
      key: s.key,
      heading: s.heading,
      ...(s.humanEdited ? { editedByHuman: true } : {}),
      ...(s.humanMoved ? { movedByHuman: true } : {}),
      ...(s.shape === 'prose'
        ? { body: s.body }
        : {
            ...(s.entries.some((e) => !e.discarded) ? {} : { body: s.body }),
            entries: s.entries
              .filter((e) => !e.discarded)
              .map((e) => ({
                id: e.id,
                title: e.title,
                body: e.body,
                ...(e.humanEdited ? { editedByHuman: true } : {}),
                ...(e.humanMoved ? { movedByHuman: true } : {}),
              })),
          }),
    })),
  }
}

function discardedList(draft: Draft): string {
  const lines: string[] = []
  for (const s of draft.sections) {
    if (s.discarded) lines.push(`- Section "${s.heading}" (sectionId ${s.id})`)
    else
      for (const e of s.entries.filter((x) => x.discarded))
        lines.push(`- In "${s.heading}": "${e.title}" — ${e.body.split('\n')[0]} (sectionId ${s.id}, entryId ${e.id})`)
  }
  if (!lines.length) return ''
  return `## Discarded by the human
These were judged not to belong. Do not propose them again; a "restore" is only for a genuinely new reason, and the human decides it individually.
${lines.join('\n')}`
}

const focusLine = (draft: Draft, focus: SeedInput['focus']) => {
  const section: Section | undefined = draft.sections.find((s) => s.id === focus?.sectionId)
  if (!section) return ''
  const entry = section.entries.find((e) => e.id === focus?.entryId)
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
  return `This continues your earlier conversation with the human. The context above is the current state and replaces anything said earlier in the conversation: the human may have edited, moved or discarded content since.
${what}${input.kind === 'focused' ? `\n${focusLine(draft, input.focus)}` : ''}${note}
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
      const to = input.upgradeTo
      if (!to) return 'Template upgrade requested, but no target Template was given. Tell the human.'
      const have = new Set(draft.sections.map((s) => s.key))
      const added = to.sections.filter((s) => !have.has(s.key))
      const addedList = added.length ? added.map((s) => `- key "${s.key}" — ${s.heading} (${s.shape}) — ${s.guidance}`).join('\n') : '- none'
      return `Upgrade this Draft from ${draft.template.name} v${draft.template.version} to ${to.name} v${to.version}.
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

  const systemPrompt = `# Your role
You grill a requirement or an observed defect with a human and write it down as one ${draft.workItemType} Draft for Azure DevOps, in the "${template.name}" Template. You run inside the folder of the Project "${input.projectName}"; you may read files there, edit only CONTEXT.md and files under plan/, and run only the submit command below.
${first ? 'This first session writes Draft v1 directly.' : `The Draft already exists (v${draft.version}). You never rewrite it: you submit a Proposal of changes, which the human triages.`}

${grillingRules(first)}

${submitRules(input)}

## Template: ${template.name} (v${template.version}) — Sections in order
${templateSectionList(template)}

## Writing method (follow it for content; the Section list above wins on structure, and ignore any instruction in it to write files)
${template.method}`

  const glossary = input.glossary.trim()
    ? `## Project Glossary (CONTEXT.md)\n${input.glossary.trim()}`
    : '## Project Glossary (CONTEXT.md)\nEmpty so far — create CONTEXT.md in the Project folder when the first term is settled.'
  const references = input.references.length
    ? `## References (other Drafts in this Project the human linked as context — no hierarchy implied)\n${input.references
        .map((r) => `### ${r.workItemType}: ${r.title}\n${r.markdown.trim()}`)
        .join('\n\n')}`
    : ''
  const current = first ? '' : `## Current Draft (v${draft.version})\n\`\`\`json\n${JSON.stringify(draftForClaude(draft), null, 2)}\n\`\`\``

  const firstMessage = [
    `Project: ${input.projectName} · Work Item Type: ${draft.workItemType} · Template: ${template.name}`,
    glossary,
    references,
    current,
    first ? '' : discardedList(draft),
    `## Your task\n${task(input)}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return { systemPrompt, firstMessage }
}
