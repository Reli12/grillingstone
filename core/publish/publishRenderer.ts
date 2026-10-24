// Publish Renderer (ADR-0008): the exact field values a Draft is copied or Published as — non-Discarded
// content only, in the human's order, grouped by each Section's target field. Drives "Copy for <Tracker>"
// in v1 and is the verbatim payload of Azure DevOps Publish in v2.
import type { Draft, Entry, IterationLogLine, Section } from '#core/draft/draftTypes.ts'
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { escapeHtml, inlineHtml, markdownToHtml } from '#core/shared/markdownHtml.ts'
import { escapeWiki, inlineWiki, markdownToWiki } from '#core/shared/markdownWiki.ts'
import { JIRA_FIELDS } from '#core/shared/trackerFields.ts'
import { defaultIterationLogTarget } from '#core/shared/workItemType.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

/** HTML for rich-text fields (Azure DevOps, Jira's rich paste); Jira wiki markup for Data Center's Text mode. */
export type RenderFormat = 'html' | 'jira-wiki'

export interface Rendered {
  /** Plain text — a title is never a rich-text field. */
  title: string
  /** Target field (an Azure DevOps reference name, a Jira field or a Custom Field) → content in the format asked for. */
  fields: Record<string, string>
}

// A Gherkin keyword at the start of a line, capturing its indentation and the keyword itself.
const GHERKIN_KEYWORD = /^(\s*)(Given|When|Then|And|But)\b/
// The YYYY-MM-DD part of an ISO timestamp.
const ISO_DATE_LENGTH = 10

/** The few pieces a format needs: how to write a heading, prose, inline text, bold and the gaps between them. */
interface Emitter {
  heading: (text: string) => string
  prose: (markdown: string) => string
  inline: (text: string) => string
  escape: (text: string) => string
  bold: (rendered: string) => string
  /** Lines inside one block. */
  lineBreak: string
  /** A paragraph made of rendered lines. */
  paragraph: (lines: string[]) => string
  /** Between blocks. */
  blockGap: string
}

const HTML: Emitter = {
  heading: (text) => `<h2>${escapeHtml(text)}</h2>\n`,
  prose: markdownToHtml,
  inline: inlineHtml,
  escape: escapeHtml,
  bold: (rendered) => `<strong>${rendered}</strong>`,
  lineBreak: '<br>',
  paragraph: (lines) => `<p>${lines.join('<br>')}</p>`,
  blockGap: '\n',
}

const JIRA_WIKI: Emitter = {
  heading: (text) => `h2. ${escapeWiki(text)}\n`,
  prose: markdownToWiki,
  inline: inlineWiki,
  escape: escapeWiki,
  bold: (rendered) => `*${rendered}*`,
  lineBreak: '\n',
  paragraph: (lines) => lines.join('\n'),
  blockGap: '\n\n',
}

const EMITTERS: Record<RenderFormat, Emitter> = { html: HTML, 'jira-wiki': JIRA_WIKI }

/** One Entry line, with a leading Gherkin keyword in bold. */
function entryLine(line: string, emit: Emitter): string {
  const keywordMatch = GHERKIN_KEYWORD.exec(line)
  if (!keywordMatch) return emit.inline(line)
  const [matched, indent, keyword] = keywordMatch
  return `${indent}${emit.bold(keyword)}${emit.inline(line.slice(matched.length))}`
}

function entryBlock(entry: Entry, emit: Emitter): string {
  const lines = entry.body.split('\n').map((line) => entryLine(line, emit))
  return emit.paragraph([emit.bold(emit.inline(entry.title)), lines.join(emit.lineBreak)])
}

function sectionBody(section: Section, emit: Emitter): string {
  if (section.shape === 'prose') return emit.prose(section.body)
  const entries = section.entries.filter((entry) => !entry.discarded)
  return entries.length ? entries.map((entry) => entryBlock(entry, emit)).join(emit.blockGap) : emit.prose(section.body)
}

/** DD.MM.YYYY — the Iteration Log format the Default PBI Template uses. */
export const formatLogDate = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, ISO_DATE_LENGTH).split('-')
  return `${day}.${month}.${year}`
}
export const iterationLogLine = (line: IterationLogLine) =>
  `${formatLogDate(line.date)} - @${line.author} v${line.version}`

/** The Iteration Log as one block under its heading. */
function iterationLog(draft: Draft, emit: Emitter): string {
  const lines = draft.iterationLog.map((line) => emit.escape(iterationLogLine(line)))
  return `${emit.heading(draft.template.iterationLogHeading)}${emit.paragraph(lines)}`
}

/** Description fields carry many Sections, so each keeps its heading there. */
const DESCRIPTION_FIELDS: string[] = [ADO_FIELDS.description, JIRA_FIELDS.description]

export function render(draft: Draft, format: RenderFormat = 'html'): Rendered {
  const emit = EMITTERS[format]
  const visible = draft.sections.filter((section) => !section.discarded)
  const byField = new Map<string, Section[]>()
  for (const section of visible) byField.set(section.target, [...(byField.get(section.target) ?? []), section])

  const fields: Record<string, string> = {}
  for (const [field, sections] of byField) {
    // A field holding a single Section (e.g. Acceptance Criteria) is already named by the field itself.
    const withHeadings = DESCRIPTION_FIELDS.includes(field) || sections.length > 1
    const heading = (section: Section) => (withHeadings ? emit.heading(section.heading) : '')
    fields[field] = sections.map((section) => heading(section) + sectionBody(section, emit)).join(emit.blockGap)
  }

  if (draft.iterationLog.length) {
    const log = iterationLog(draft, emit)
    const tracker = templateTracker(draft.template)
    const target = draft.template.iterationLogTarget ?? defaultIterationLogTarget(tracker, draft.workItemType)
    fields[target] = fields[target] ? `${fields[target]}${emit.blockGap}${log}` : log
  }
  return { title: draft.title, fields }
}
