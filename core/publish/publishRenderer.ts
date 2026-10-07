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

const GHERKIN_KEYWORD = /^(\s*)(Given|When|Then|And|But)\b/

function entryHtml(e: Entry): string {
  const lines = e.body.split('\n').map((l) => {
    const m = GHERKIN_KEYWORD.exec(l)
    return m ? `${m[1]}<strong>${m[2]}</strong>${inlineHtml(l.slice(m[0].length))}` : inlineHtml(l)
  })
  return `<p><strong>${inlineHtml(e.title)}</strong><br>${lines.join('<br>')}</p>`
}

function sectionBodyHtml(s: Section): string {
  if (s.shape === 'prose') return markdownToHtml(s.body)
  const entries = s.entries.filter((e) => !e.discarded)
  return entries.length ? entries.map(entryHtml).join('\n') : markdownToHtml(s.body)
}

/** DD.MM.YYYY — the Iteration Log format the Default PBI Template uses. */
export const formatLogDate = (isoDate: string) => {
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}
export const iterationLogLine = (l: IterationLogLine) => `${formatLogDate(l.date)} - @${l.author} v${l.version}`

export function render(draft: Draft): Rendered {
  const visible = draft.sections.filter((s) => !s.discarded)
  const byField = new Map<string, Section[]>()
  for (const s of visible) byField.set(s.target, [...(byField.get(s.target) ?? []), s])

  const fields: Record<string, string> = {}
  for (const [field, sections] of byField) {
    // The Description carries many Sections, so each keeps its heading; a field holding a single
    // Section (e.g. Acceptance Criteria) is already named by the field itself.
    const withHeadings = field === ADO_FIELDS.description || sections.length > 1
    fields[field] = sections
      .map((s) => (withHeadings ? `<h2>${escapeHtml(s.heading)}</h2>\n` : '') + sectionBodyHtml(s))
      .join('\n')
  }

  if (draft.iterationLog.length) {
    const log = `<h2>${escapeHtml(draft.template.iterationLogHeading)}</h2>\n<p>${draft.iterationLog.map((l) => escapeHtml(iterationLogLine(l))).join('<br>')}</p>`
    const target = draft.template.iterationLogTarget ?? defaultIterationLogTarget(draft.workItemType)
    fields[target] = fields[target] ? `${fields[target]}\n${log}` : log
  }
  return { title: draft.title, fields }
}
