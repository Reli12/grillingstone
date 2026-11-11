// A Project's Azure DevOps settings: its Backlog (named by the human, checked for Scrum's types, fixed once any Draft
// is linked) and its Default Tags.
import { backlogEligibility } from '#core/ado/backlogEligibility.ts'
import { parseProjectAddress } from '#core/ado/workItemAddress.ts'
import type { Project } from '#core/contract/apiTypes.ts'
import { cleanTags } from '#core/publish/publishPlan.ts'

import type { Hub } from '../hub.ts'
import { listDrafts } from '../storage/drafts.ts'
import { getProject, saveBacklog, saveDefaultTags } from '../storage/projects.ts'
import { AdoRefusal } from './adoRefusal.ts'
import type { ConnectionService } from './connectionService.ts'

/** Publish, the Backlog, Import, Refresh and Drift exist only for Azure DevOps Projects. */
export async function adoProject(projectId: string): Promise<Project> {
  const project = await getProject(projectId)
  if (project.tracker !== 'azure-devops') throw new AdoRefusal('Only an Azure DevOps Project talks to Azure DevOps.')
  return project
}

/** Every Draft of the Project with a Linked Work Item, archived ones included: they still point into the Backlog. */
export const linkedDrafts = async (projectId: string) =>
  (await listDrafts(projectId)).filter((draft) => draft.linkedWorkItem)

export class BacklogService {
  private hub: Hub
  private connection: ConnectionService

  constructor(hub: Hub, connection: ConnectionService) {
    this.hub = hub
    this.connection = connection
  }

  private async refuseIfFixed(project: Project) {
    if (!project.backlog) return
    if ((await linkedDrafts(project.id)).length)
      throw new AdoRefusal(`The Backlog is fixed: some Drafts have Linked Work Items in ${project.backlog}.`)
  }

  /** Accepts the named Azure DevOps project only if it exists with all of Scrum's types; saved in its own spelling. */
  async setBacklog(projectId: string, input: string): Promise<Project> {
    const project = await adoProject(projectId)
    const client = await this.connection.client()
    const organization = (await this.connection.organization()) ?? ''
    const parsed = parseProjectAddress(input, organization)
    if (!parsed.ok) throw new AdoRefusal(parsed.reason)
    const lookup = await client.lookupProject(parsed.project)
    const eligible = backlogEligibility(parsed.project, organization, lookup)
    if (!eligible.ok) throw new AdoRefusal(eligible.reason)
    if (eligible.name === project.backlog) return project
    await this.refuseIfFixed(project)
    const saved = await saveBacklog(projectId, eligible.name)
    this.hub.broadcast({ type: 'project', projectId })
    return saved
  }

  async clearBacklog(projectId: string): Promise<Project> {
    const project = await adoProject(projectId)
    await this.refuseIfFixed(project)
    const saved = await saveBacklog(projectId, null)
    this.hub.broadcast({ type: 'project', projectId })
    return saved
  }

  /** Changing them never touches work items already created. */
  async setDefaultTags(projectId: string, tags: string[]): Promise<Project> {
    await adoProject(projectId)
    const saved = await saveDefaultTags(projectId, cleanTags(tags))
    this.hub.broadcast({ type: 'project', projectId })
    return saved
  }
}
