// What the human types to name something in Azure DevOps: the organization URL, a work item (ID or link) or an
// Azure DevOps project (name or any link from it). Links from another organization are refused.
import { parseWorkItemId } from '#core/backlog/backlogCopy.ts'

export type Parsed<T> = ({ ok: true } & T) | { ok: false; reason: string }

// https://dev.azure.com/{org}[/...] and the older https://{org}.visualstudio.com[/...]
const DEV_AZURE = /^https?:\/\/dev\.azure\.com\/([^/?#\s]+)(\/[^?#\s]*)?(?:[?#]\S*)?$/i
const VISUAL_STUDIO = /^https?:\/\/([a-z0-9-]+)\.visualstudio\.com(\/[^?#\s]*)?(?:[?#]\S*)?$/i
/** An Azure DevOps organization name: letters, digits and dashes. */
const ORG_NAME = /^[a-z0-9][a-z0-9-]*$/i
/** URL segments after the project that mean "not a project" (organization-level pages). */
const ORG_LEVEL_SEGMENTS = new Set(['_apis', '_settings', '_usersSettings', '_signin'])

interface UrlParts {
  organization: string
  /** The path segments after the organization, decoded. */
  segments: string[]
}

function urlParts(input: string): UrlParts | null {
  const text = input.trim()
  const match = DEV_AZURE.exec(text) ?? VISUAL_STUDIO.exec(text)
  if (!match) return null
  const segments = (match[2] ?? '')
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
  return { organization: match[1].toLowerCase(), segments }
}

export const orgUrlOf = (organization: string) => `https://dev.azure.com/${organization}`

/** The organization URL in its canonical form, from a dev.azure.com or visualstudio.com link or a bare name. */
export function parseOrganization(input: string): Parsed<{ organization: string; orgUrl: string }> {
  const text = input.trim()
  const parts = urlParts(text)
  const organization = parts?.organization ?? (ORG_NAME.test(text) ? text.toLowerCase() : null)
  if (!organization) return { ok: false, reason: 'Enter the organization URL, e.g. https://dev.azure.com/your-org.' }
  return { ok: true, organization, orgUrl: orgUrlOf(organization) }
}

const otherOrganization = (organization: string, expected: string) =>
  `That link is from the organization "${organization}", but the tool is connected to "${expected}".`

/** A work item ID from "1234", "#1234" or a work item link of the connected organization. */
export function parseWorkItemAddress(input: string, organization: string): Parsed<{ workItemId: number }> {
  const parts = urlParts(input)
  if (parts && parts.organization !== organization.toLowerCase())
    return { ok: false, reason: otherOrganization(parts.organization, organization) }
  return parseWorkItemId(input)
}

/** An Azure DevOps project's name, typed or taken from any link inside it. The spelling is checked later. */
export function parseProjectAddress(input: string, organization: string): Parsed<{ project: string }> {
  const text = input.trim()
  if (!text) return { ok: false, reason: 'Enter the Azure DevOps project’s name, or paste a link from it.' }
  const parts = urlParts(text)
  if (!parts) {
    if (/^https?:\/\//i.test(text))
      return { ok: false, reason: 'That is not an Azure DevOps link. Paste a dev.azure.com link, or type the name.' }
    return { ok: true, project: text }
  }
  if (parts.organization !== organization.toLowerCase())
    return { ok: false, reason: otherOrganization(parts.organization, organization) }
  const project = parts.segments[0]
  if (!project || project.startsWith('_') || ORG_LEVEL_SEGMENTS.has(project))
    return { ok: false, reason: 'That link names no project. Paste a link from inside the Azure DevOps project.' }
  return { ok: true, project }
}
