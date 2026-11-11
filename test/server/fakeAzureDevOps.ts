// An in-memory Azure DevOps for server tests, faked at the HTTP boundary (the fetch the client is given): one
// organization, its projects with their Work Item Types, and work items with revisions, parents and fields. Only the
// calls the tool makes are answered; a token other than the valid one gets a 401. No test reaches a real organization.
import type { Secrets, SecretStore } from '../../server/ado/secretStore.ts'

export const ORG_URL = 'https://dev.azure.com/acme'
export const GOOD_TOKEN = 'good-token'

const SCRUM_TYPES = ['Epic', 'Feature', 'Product Backlog Item', 'Task', 'Bug', 'Impediment']

export interface FakeItem {
  id: number
  rev: number
  project: string
  fields: Record<string, unknown>
  parentId?: number
}

/** A Secret Store that keeps the token in memory, so tests never touch the platform's own store. */
export class MemorySecretStore implements SecretStore {
  kind = 'file' as const
  description = 'In memory (tests).'
  readOnly = false
  secrets: Secrets | null

  constructor(secrets: Secrets | null = null) {
    this.secrets = secrets
  }

  read() {
    return Promise.resolve(this.secrets)
  }

  write(secrets: Secrets) {
    this.secrets = secrets
    return Promise.resolve()
  }

  clear() {
    this.secrets = null
    return Promise.resolve()
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export class FakeAzureDevOps {
  projects = new Map<string, string[]>([
    ['Customer Portal', SCRUM_TYPES],
    ['Billing', SCRUM_TYPES],
    ['Legacy CRM', ['Epic', 'Feature', 'User Story', 'Task', 'Bug']],
  ])
  items = new Map<number, FakeItem>()
  token = GOOD_TOKEN
  /** Every request, as "METHOD path", for asserting what was (not) called. */
  calls: string[] = []
  private nextId = 900

  add(item: Omit<FakeItem, 'rev'> & { rev?: number }): FakeItem {
    const stored = { rev: 1, ...item }
    this.items.set(item.id, stored)
    return stored
  }

  /** Someone edits the item in Azure DevOps. */
  edit(id: number, fields: Record<string, unknown>) {
    const item = this.items.get(id)!
    item.fields = { ...item.fields, ...fields }
    item.rev += 1
  }

  private response(item: FakeItem) {
    return {
      id: item.id,
      rev: item.rev,
      fields: { ...item.fields, 'System.TeamProject': item.project, 'System.Rev': item.rev },
      relations: item.parentId
        ? [{ rel: 'System.LinkTypes.Hierarchy-Reverse', url: `${ORG_URL}/_apis/wit/workItems/${item.parentId}` }]
        : [],
      _links: { html: { href: `${ORG_URL}/${encodeURIComponent(item.project)}/_workitems/edit/${item.id}` } },
    }
  }

  private project(name: string) {
    return [...this.projects.keys()].find((candidate) => candidate.toLowerCase() === name.toLowerCase())
  }

  /** Applies a JSON Patch; a failed revision test is answered as Azure DevOps does. */
  private patch(item: FakeItem, ops: { op: string; path: string; value: unknown }[]): Response | null {
    for (const op of ops) {
      if (op.op === 'test' && op.path === '/rev' && op.value !== item.rev)
        return json(400, { message: 'TF26071: This work item has been changed by someone else since you opened it.' })
      if (op.path.startsWith('/fields/')) item.fields[op.path.slice('/fields/'.length)] = op.value
      if (op.path === '/relations/-') {
        const url = (op.value as { url: string }).url
        item.parentId = Number(url.split('/').pop())
      }
    }
    return null
  }

  fetch = (url: string, init: RequestInit = {}): Promise<Response> => Promise.resolve(this.answer(url, init))

  private answer(url: string, init: RequestInit): Response {
    const method = init.method ?? 'GET'
    const parsed = new URL(url)
    const path = decodeURIComponent(parsed.pathname.replace(/^\/acme/, ''))
    this.calls.push(`${method} ${path}`)
    if (!url.startsWith(`${ORG_URL}/`)) return json(404, { message: 'No such organization' })
    const auth = new Headers(init.headers).get('authorization')
    if (auth !== `Basic ${Buffer.from(`:${this.token}`).toString('base64')}`) return json(401, {})

    // Like Azure DevOps: connectionData exists only as a preview API.
    if (path === '/_apis/connectionData' && parsed.searchParams.get('api-version') !== '7.1-preview')
      return json(400, { message: 'The requested version "7.1" of the resource is under preview.' })
    if (path === '/_apis/connectionData')
      return json(200, { authenticatedUser: { providerDisplayName: 'Dana Developer' } })

    const areas = /^\/([^/]+)\/_apis\/wit\/classificationnodes\/areas$/.exec(path)
    if (areas) {
      const name = this.project(areas[1])
      return name ? json(200, { name }) : json(404, { message: 'No project' })
    }
    const types = /^\/([^/]+)\/_apis\/wit\/workitemtypes$/.exec(path)
    if (types) {
      const name = this.project(types[1])
      return name ? json(200, { value: this.projects.get(name)!.map((type) => ({ name: type })) }) : json(404, {})
    }

    const create = /^\/([^/]+)\/_apis\/wit\/workitems\/\$(.+)$/.exec(path)
    if (create && method === 'POST') {
      const project = this.project(create[1])
      if (!project) return json(404, {})
      const item = this.add({
        id: this.nextId++,
        project,
        fields: { 'System.WorkItemType': create[2], 'System.State': 'New' },
      })
      this.patch(item, JSON.parse(typeof init.body === 'string' ? init.body : '[]'))
      return json(200, this.response(item))
    }

    const one = /^\/_apis\/wit\/workitems\/(\d+)$/.exec(path)
    if (one) {
      const item = this.items.get(Number(one[1]))
      if (!item) return json(404, { message: 'No such work item' })
      if (method === 'PATCH') {
        const refused = this.patch(item, JSON.parse(typeof init.body === 'string' ? init.body : '[]'))
        if (refused) return refused
        item.rev += 1
      }
      return json(200, this.response(item))
    }

    if (path === '/_apis/wit/workitems') {
      const ids = (parsed.searchParams.get('ids') ?? '').split(',').map(Number)
      return json(200, {
        value: ids.map((id) => this.items.get(id)).map((item) => (item ? this.response(item) : null)),
      })
    }
    return json(404, { message: `Fake Azure DevOps has no ${method} ${path}` })
  }
}
