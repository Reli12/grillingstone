// The Import Session's seed: one turn that moves an existing Azure DevOps work item's content into the Template's
// Sections. It never grills, asks or adds — starting the Import was the human's confirmation. Not a Grilling Session.
import type { Draft } from '#core/draft/draftTypes.ts'
import { type Seed, submitOutcomeRules, type SubmitProtocol, submitSteps } from '#core/session/cardProtocol.ts'
import type { TemplateSection } from '#core/template/templateTypes.ts'

export interface ImportSeedInput extends SubmitProtocol {
  draft: Draft
  projectName: string
}

const sectionLine = (def: TemplateSection, index: number) =>
  `${index + 1}. key "${def.key}" — ${def.heading} (${def.shape}) — ${def.guidance}`

export function buildImportSeed(input: ImportSeedInput): Seed {
  const { draft } = input
  const template = draft.template
  const item = draft.linkedWorkItem
  const name = item ? `#${item.id}` : 'the work item'

  const systemPrompt = `# Your role
You turn an existing Azure DevOps ${draft.workItemType} (${name}) into Draft v1 in the "${template.name}" Template, in one turn. This is an Import, not a grilling: you never ask the human anything, never run a Ready Check and never add content of your own. Starting the Import was the human's confirmation, so you write straight away.

## Rules
- Move the item's text into the Section it belongs to. Copy it word for word: never reword, summarise, translate, correct or complete it.
- You may split the text across Sections and turn list items or bold-titled paragraphs into Entries (the Entry title is the item's own words). Keep the item's order inside a Section.
- A Section the item has nothing for gets "body": "N/A — not in ${name}" — Locked Sections included. Entries Sections then have no entries.
- Text that fits no Section goes, unchanged, into the closest Section that takes prose; never drop it.
- The Title is the item's title, unchanged.
- Do not read files, search the web or change CONTEXT.md. Write the payload and run the submit command, nothing else.

## How you write
${submitSteps(input, 'the whole Draft')}

JSON shape:
{"title": "Work item title", "sections": [{"key": "<Template key>", "body": "prose markdown"}, {"key": "<Template key>", "entries": [{"title": "…", "body": "…"}]}]}

- Include EVERY Template Section, in Template order, by key.

${submitOutcomeRules(input.payloadFile)}
After ACCEPTED, reply with one short sentence telling the human the Draft is imported, and stop.

## Template: ${template.name} (v${template.version}) — Sections in order
${template.sections.map(sectionLine).join('\n')}`

  const firstMessage = `Project: ${input.projectName} · Work Item Type: Azure DevOps ${draft.workItemType} · Template: ${template.name}

## The work item, as Azure DevOps holds it (markdown)
"""
${draft.requirement}
"""

Import it now: write the payload and run the submit command.`

  return { systemPrompt, firstMessage }
}
