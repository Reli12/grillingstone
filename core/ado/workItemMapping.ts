// An Azure DevOps work item response mapped to the tool's view of it, and on to what the existing flows take: the
// re-paste of a Backlog Copy (Refresh), a new Backlog Copy, and the requirement text of an Imported Draft.
import { toolTypeOf, type WorkItemView } from '#core/ado/adoTypes.ts'
import type { PastedCopy, Repaste } from '#core/backlog/backlogCopy.ts'
import { ADO_FIELDS, SECTION_TARGETS } from '#core/shared/adoFields.ts'
import { htmlToMarkdown } from '#core/shared/htmlMarkdown.ts'

/** The parts of the Azure DevOps REST answer for one work item the tool reads. */
export interface AdoWorkItemResponse {
  id: number
  rev: number
  fields: Record<string, unknown>
  relations?: { rel: string; url: string }[] | null
  _links?: { html?: { href?: string } }
  /** Which long-text fields are Markdown ("markdown") rather than HTML; sent from api-version 7.1. */
  multilineFieldsFormat?: Record<string, string>
}

const PARENT_RELATION = 'System.LinkTypes.Hierarchy-Reverse'
// The work item ID at the end of a relation's URL (…/_apis/wit/workItems/1234).
const RELATION_ID = /\/workItems\/(\d+)$/i
const TAG_SEPARATOR = /;\s*/

/** A field's value as text; Azure DevOps sends strings and numbers, anything else reads as empty. */
function text(value: unknown): string {
  if (typeof value === 'string') return value
  return typeof value === 'number' ? String(value) : ''
}

function parentOf(response: AdoWorkItemResponse): number | null {
  const parent = response.fields['System.Parent']
  if (typeof parent === 'number') return parent
  const relation = response.relations?.find((candidate) => candidate.rel === PARENT_RELATION)
  const id = relation ? RELATION_ID.exec(relation.url)?.[1] : undefined
  return id ? Number(id) : null
}

/** The fields Azure DevOps says it holds as Markdown. */
function markdownFieldsOf(response: AdoWorkItemResponse): string[] {
  return Object.entries(response.multilineFieldsFormat ?? {})
    .filter(([, format]) => format.toLowerCase() === 'markdown')
    .map(([field]) => field)
}

export function mapWorkItem(response: AdoWorkItemResponse, orgUrl: string): WorkItemView {
  const f = response.fields
  const markdownFields = markdownFieldsOf(response)
  const teamProject = text(f['System.TeamProject'])
  const fields: Record<string, string> = {}
  for (const target of SECTION_TARGETS) if (typeof f[target] === 'string') fields[target] = f[target]
  const adoType = text(f['System.WorkItemType'])
  return {
    id: response.id,
    rev: response.rev,
    adoType,
    workItemType: toolTypeOf(adoType),
    title: text(f['System.Title']),
    fields,
    parentId: parentOf(response),
    teamProject,
    areaPath: text(f['System.AreaPath']),
    iterationPath: text(f['System.IterationPath']),
    state: text(f['System.State']),
    tags: text(f['System.Tags'])
      .split(TAG_SEPARATOR)
      .map((tag) => tag.trim())
      .filter(Boolean),
    url: response._links?.html?.href ?? `${orgUrl}/${encodeURIComponent(teamProject)}/_workitems/edit/${response.id}`,
    ...(markdownFields.length ? { markdownFields } : {}),
  }
}

// Any HTML tag, which a Markdown field written in Azure DevOps does not have.
const HTML_TAG = /<\/?[a-z][\w-]*[^>]*>/i
// A setext heading's underline ("-----" or "=====") under a line of text.
const SETEXT_UNDERLINE = /^\s*(?:-{3,}|={3,})\s*$/
// An ATX heading of any level ("### Rules"), capturing its text.
const ATX_HEADING = /^\s*#{1,6}\s+(.+?)\s*#*\s*$/
const CRLF = /\r\n?/g
// Three or more line breaks in a row, kept as one blank line.
const BLANK_RUN = /\n{3,}/g

/**
 * A field Azure DevOps holds as Markdown, in the subset the tool writes: line breaks kept, and every heading
 * ("Title" over "-----", or "### Title") as "## Title". Everything else is already markdown.
 */
export function adoMarkdown(text: string): string {
  const out: string[] = []
  for (const line of text.replace(CRLF, '\n').split('\n')) {
    const previous = out[out.length - 1]
    if (SETEXT_UNDERLINE.test(line) && previous?.trim() && !previous.startsWith('## ')) {
      out[out.length - 1] = `## ${previous.trim()}`
      continue
    }
    const heading = ATX_HEADING.exec(line)?.[1]
    out.push(heading ? `## ${heading}` : line.trimEnd())
  }
  return out.join('\n').replace(BLANK_RUN, '\n\n').trim()
}

/**
 * One rich-text field of the item as markdown. Azure DevOps holds it as HTML, or as Markdown when the item says so;
 * a field with line breaks and no HTML tag at all is Markdown too, in case the item did not say.
 */
export function fieldMarkdown(item: WorkItemView, field: string): string {
  const value = item.fields[field]
  if (!value) return ''
  const markdown = item.markdownFields?.includes(field) || (!HTML_TAG.test(value) && value.includes('\n'))
  return markdown ? adoMarkdown(value) : htmlToMarkdown(value)
}

/** The item's main text: a Bug's Repro Steps (with System Info), any other type's Description. */
function mainContent(item: WorkItemView): string {
  if (item.workItemType !== 'Bug') return fieldMarkdown(item, ADO_FIELDS.description)
  const repro = fieldMarkdown(item, ADO_FIELDS.reproSteps)
  const system = fieldMarkdown(item, ADO_FIELDS.systemInfo)
  return system ? `${repro}\n\nSystem Info:\n${system}` : repro
}

/** A Refresh is a re-paste of what the item holds now. */
export function toRepaste(item: WorkItemView): Repaste {
  return {
    title: item.title,
    ...(item.workItemType ? { workItemType: item.workItemType } : {}),
    // A Backlog Copy needs some content; an item with none still says so.
    content: mainContent(item) || '(empty in Azure DevOps)',
    acceptanceCriteria: fieldMarkdown(item, ADO_FIELDS.acceptanceCriteria),
  }
}

/** A new Backlog Copy of the item, as if the human had pasted it. */
export const toPastedCopy = (item: WorkItemView): PastedCopy => {
  const repaste = toRepaste(item)
  return {
    workItem: item.url,
    workItemType: item.workItemType ?? '',
    title: item.title,
    content: repaste.content,
    acceptanceCriteria: repaste.acceptanceCriteria,
  }
}

/** Every field the item has, in markdown, under its label: an Imported Draft's requirement. */
export function importedRequirement(item: WorkItemView, labels: Record<string, string>): string {
  const parts = SECTION_TARGETS.flatMap((target) => {
    const markdown = fieldMarkdown(item, target)
    return markdown ? [`## ${labels[target] ?? target}\n\n${markdown}`] : []
  })
  return [`Imported from ${item.adoType} #${item.id}: ${item.title}`, ...parts].join('\n\n')
}
