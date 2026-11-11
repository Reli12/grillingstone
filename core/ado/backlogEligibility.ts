// Whether an Azure DevOps project can be a Project's Backlog: it must exist and have every Scrum Work Item Type,
// none of them disabled (an inherited process may disable one).
import { REQUIRED_ADO_TYPES } from '#core/ado/adoTypes.ts'

/** What Azure DevOps answered for the named project. */
export type BacklogLookup =
  | { found: false }
  | {
      found: true
      /** The project's own spelling, from its root area. */
      name: string
      types: { name: string; isDisabled?: boolean }[]
    }

export type BacklogEligibility = { ok: true; name: string } | { ok: false; reason: string }

export function backlogEligibility(requested: string, organization: string, lookup: BacklogLookup): BacklogEligibility {
  if (!lookup.found)
    return { ok: false, reason: `No Azure DevOps project "${requested}" in ${organization}. Check the spelling.` }
  const enabled = new Set(lookup.types.filter((type) => !type.isDisabled).map((type) => type.name.toLowerCase()))
  const missing = REQUIRED_ADO_TYPES.filter((type) => !enabled.has(type.toLowerCase()))
  if (missing.length)
    return {
      ok: false,
      reason: `${lookup.name} has no ${missing.join(', ')} — its process must be Scrum or inherit from Scrum.`,
    }
  return { ok: true, name: lookup.name }
}
