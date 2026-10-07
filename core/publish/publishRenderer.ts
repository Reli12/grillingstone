// Publish Renderer (ADR-0008): the exact field values for Azure DevOps — non-Discarded content only,
// in the human's order, grouped by each Section's target field. Drives "Copy for Azure DevOps" in v1
// and is the verbatim MCP payload in v2.
import type { Draft, Entry, IterationLogLine, Section } from '#core/draft/draftTypes.ts'
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { escapeHtml, inlineHtml, markdownToHtml } from '#core/shared/markdownHtml.ts'
import { defaultIterationLogTarget } from '#core/shared/workItemType.ts'

export interface Rendered {
  /** Plain text — System.Title is not a rich-text field. */
  title: string
  /** ADO field reference name → HTML. */
  fields: Record<string, string>
}

// A Gherkin keyword at the start of a line, capturing its indentation and the keyword itself.
const GHERKIN_KEYWORD = /^(\s*)(Given|When|Then|And|But)\b/
// The YYYY-MM-DD part of an ISO timestamp.
const ISO_DATE_LENGTH = 10

/** One Entry line, with a leading Gherkin keyword in bold. */
function entryLineHtml(line: string): string {
  const keywordMatch = GHERKIN_KEYWORD.exec(line)
  if (!keywordMatch) return inlineHtml(line)
  const [matched, indent, keyword] = keywordMatch
  return `${indent}<strong>${keyword}</strong>${inlineHtml(line.slice(matched.length))}`
}

function entryHtml(entry: Entry): string {
  const lines = entry.body.split('\n').map(entryLineHtml)
  return `<p><strong>${inlineHtml(entry.title)}</strong><br>${lines.join('<br>')}</p>`
}

function sectionBodyHtml(section: Section): string {
  if (section.shape === 'prose') return markdownToHtml(section.body)
  const entries = section.entries.filter((entry) => !entry.discarded)
  return entries.length ? entries.map(entryHtml).join('\n') : markdownToHtml(section.body)
}

/** DD.MM.YYYY — the Iteration Log format the Default PBI Template uses. */
export const formatLogDate = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, ISO_DATE_LENGTH).split('-')
  return `${day}.${month}.${year}`
}
export const iterationLogLine = (line: IterationLogLine) =>
  `${formatLogDate(line.date)} - @${line.author} v${line.version}`

/** The Iteration Log as one HTML block under its heading. */
function iterationLogHtml(draft: Draft): string {
  const lines = draft.iterationLog.map((line) => escapeHtml(iterationLogLine(line)))
  return `<h2>${escapeHtml(draft.template.iterationLogHeading)}</h2>\n<p>${lines.join('<br>')}</p>`
}

export function render(draft: Draft): Rendered {
  const visible = draft.sections.filter((section) => !section.discarded)
  const byField = new Map<string, Section[]>()
  for (const section of visible) byField.set(section.target, [...(byField.get(section.target) ?? []), section])

  const fields: Record<string, string> = {}
  for (const [field, sections] of byField) {
    // The Description carries many Sections, so each keeps its heading; a field holding a single
    // Section (e.g. Acceptance Criteria) is already named by the field itself.
    const withHeadings = field === ADO_FIELDS.description || sections.length > 1
    const headingHtml = (section: Section) => (withHeadings ? `<h2>${escapeHtml(section.heading)}</h2>\n` : '')
    fields[field] = sections.map((section) => headingHtml(section) + sectionBodyHtml(section)).join('\n')
  }

  if (draft.iterationLog.length) {
    const log = iterationLogHtml(draft)
    const target = draft.template.iterationLogTarget ?? defaultIterationLogTarget(draft.workItemType)
    fields[target] = fields[target] ? `${fields[target]}\n${log}` : log
  }
  return { title: draft.title, fields }
}
