// What "Copy for <Tracker>" shows: the rendered fields of a Draft, labelled and in the order its Tracker's
// create form asks for them, with Jira wiki markup beside the rich text for Jira Data Center's Text mode.
import type { Draft } from '#core/draft/draftTypes.ts'
import { render } from '#core/publish/publishRenderer.ts'
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import type { Tracker } from '#core/shared/tracker.ts'
import { fieldLabel, isCustomFieldTarget, JIRA_FIELDS } from '#core/shared/trackerFields.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

export interface CopyField {
  /** The target field, or the title field for the title. */
  field: string
  label: string
  /** Rich text; null for the plain-text title. */
  html: string | null
  /** The title as typed. */
  text: string
  /** Jira wiki markup; null outside Jira. */
  wiki: string | null
}

export interface CopyPayload {
  tracker: Tracker
  fields: CopyField[]
}

const TITLE_FIELD: Record<Tracker, string> = { 'azure-devops': ADO_FIELDS.title, jira: JIRA_FIELDS.summary }

/** Jira's own fields first, as its create screen shows them; Custom Fields after, in the Template's order. */
const JIRA_ORDER: string[] = [JIRA_FIELDS.description, JIRA_FIELDS.environment]

/** Description first, as on the Azure DevOps form; the other fields alphabetically by reference name. */
function adoOrder(fields: string[]): string[] {
  const rest = fields
    .filter((field) => field !== ADO_FIELDS.description)
    .sort((first, second) => first.localeCompare(second))
  return fields.includes(ADO_FIELDS.description) ? [ADO_FIELDS.description, ...rest] : rest
}

function jiraOrder(fields: string[]): string[] {
  const system = JIRA_ORDER.filter((field) => fields.includes(field))
  return [...system, ...fields.filter(isCustomFieldTarget)]
}

export function copyFields(draft: Draft): CopyPayload {
  const tracker = templateTracker(draft.template)
  const rich = render(draft)
  const wiki = tracker === 'jira' ? render(draft, 'jira-wiki') : null
  const present = Object.keys(rich.fields)
  const ordered = tracker === 'jira' ? jiraOrder(present) : adoOrder(present)

  const titleField = TITLE_FIELD[tracker]
  const title: CopyField = {
    field: titleField,
    label: fieldLabel(titleField),
    html: null,
    text: rich.title,
    wiki: wiki ? rich.title : null,
  }
  const body = ordered.map((field): CopyField => ({
    field,
    label: fieldLabel(field),
    html: rich.fields[field],
    text: '',
    wiki: wiki ? wiki.fields[field] : null,
  }))
  return { tracker, fields: [title, ...body] }
}
