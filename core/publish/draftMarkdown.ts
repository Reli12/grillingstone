// drafts/<id>.md — a readable rendering of the Draft JSON, regenerated on every save (ADR-0004).
import type { Draft, Section } from '#core/draft/draftTypes.ts'
import { iterationLogLine } from '#core/publish/publishRenderer.ts'
import { ADO_FIELD_LABELS } from '#core/shared/adoFields.ts'

// Every line break, so each requirement line can be prefixed as a Markdown quote.
const NEWLINE = /\n/g

const sectionMd = (section: Section) => {
  const entries = section.entries.filter((entry) => !entry.discarded)
  const showEntries = section.shape === 'entries' && entries.length
  const body = showEntries ? entries.map((entry) => `**${entry.title}**\n\n${entry.body}`).join('\n\n') : section.body
  return `## ${section.heading}\n\n${body.trim()}`
}

export function draftMarkdown(draft: Draft): string {
  // Before v1 there is only the requirement being grilled.
  if (draft.version === 0)
    return `# ${draft.title || 'Untitled Draft'}\n\n_No Draft yet — grilling in progress._\n\n> ${draft.requirement.replace(NEWLINE, '\n> ')}\n`
  const visible = draft.sections.filter((section) => !section.discarded)
  // One line per Discarded Section, or per Discarded Entry inside a kept Section.
  const discarded = draft.sections.flatMap((section) =>
    section.discarded
      ? [`- Section: ${section.heading}`]
      : section.entries.filter((entry) => entry.discarded).map((entry) => `- ${section.heading}: ${entry.title}`),
  )
  const generatedNotice = `<!-- Generated from ${draft.id}.json — edit in Whetstone; changes here are overwritten. -->`
  const subtitle = `_${draft.workItemType} · ${draft.template.name} v${draft.template.version} · Draft v${draft.version}_`
  const header = `${generatedNotice}\n# ${draft.title}\n\n${subtitle}`
  // The visible Sections grouped under a comment naming the Azure DevOps field they Publish into.
  const byField = [...new Set(visible.map((section) => section.target))]
  const body = byField
    .map((field) => {
      const fieldLabel = ADO_FIELD_LABELS[field] ?? field
      const sectionsMd = visible
        .filter((section) => section.target === field)
        .map(sectionMd)
        .join('\n\n')
      return `<!-- Azure DevOps field: ${fieldLabel} -->\n\n${sectionsMd}`
    })
    .join('\n\n')
  const logLines = draft.iterationLog.map((line) => `${iterationLogLine(line)} — ${line.note}`).join('\n')
  const log = `## ${draft.template.iterationLogHeading}\n\n${logLines}`
  const discardedBlock = discarded.length ? `\n\n## Discarded (kept, not published)\n\n${discarded.join('\n')}` : ''
  return `${header}\n\n${body}\n\n${log}${discardedBlock}\n`
}
