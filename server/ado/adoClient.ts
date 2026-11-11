// Azure DevOps Client: a thin adapter over the REST API with an injected fetch, so tests fake Azure DevOps at the
// HTTP boundary. Maps 401 (and the sign-in page Azure DevOps answers a bad token with) to TokenRejected, 404 to
// AdoNotFound and a failed revision guard to ChangedMeanwhile. Never logs, returns or puts the token in a message.
import type { BacklogLookup } from '#core/ado/backlogEligibility.ts'
import type { AdoWorkItemResponse } from '#core/ado/workItemMapping.ts'
import type { PatchOperation } from '#core/publish/publishPlan.ts'

const API_VERSION = '7.1'
/** connectionData (who the token is) exists only as a preview API. */
const PREVIEW_API_VERSION = '7.1-preview'
const HTTP_OK_NON_AUTHORITATIVE = 203
const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_NOT_FOUND = 404
const HTTP_CONFLICT = 409
const HTTP_PRECONDITION_FAILED = 412
/** Azure DevOps refuses lists of more ids than this in one call. */
const MAX_IDS_PER_CALL = 200

const patchHeaders = { 'content-type': 'application/json-patch+json' }

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

/** Anything Azure DevOps refused or failed. */
export class AdoError extends Error {}
/** The token was refused: expired, revoked or wrong. */
export class TokenRejected extends AdoError {
  constructor() {
    super('Azure DevOps rejected the token — it may have expired or been revoked. Replace it in Settings.')
  }
}
/** The token works but lacks a permission. */
export class AdoForbidden extends AdoError {}
export class AdoNotFound extends AdoError {}
/** The work item changed between reading it and writing it. */
export class ChangedMeanwhile extends AdoError {
  constructor() {
    super('The work item changed in Azure DevOps meanwhile. Check it again before Publishing.')
  }
}

interface WorkItemTypesResponse {
  value: { name: string; isDisabled?: boolean }[]
}

export class AdoClient {
  private orgUrl: string
  private authorization: string
  private fetch: FetchLike
  /** Called (and awaited) on every 401, so the Connection shows the token as rejected before anyone asks again. */
  private onRejected: () => Promise<void> | void

  constructor(opts: { orgUrl: string; token: string; fetch?: FetchLike; onRejected?: () => Promise<void> | void }) {
    this.orgUrl = opts.orgUrl.replace(/\/+$/, '')
    this.authorization = `Basic ${Buffer.from(`:${opts.token}`).toString('base64')}`
    this.fetch = opts.fetch ?? ((url, init) => fetch(url, init))
    this.onRejected = opts.onRejected ?? (() => undefined)
  }

  get organizationUrl() {
    return this.orgUrl
  }

  private url(pathname: string, query: Record<string, string> = {}) {
    const params = new URLSearchParams({ 'api-version': API_VERSION, ...query })
    return `${this.orgUrl}/${pathname}?${params.toString()}`
  }

  private async request<T>(url: string, init: RequestInit = {}, what = 'Azure DevOps'): Promise<T> {
    let res: Response
    try {
      res = await this.fetch(url, {
        ...init,
        redirect: 'manual',
        headers: { accept: 'application/json', authorization: this.authorization, ...init.headers },
      })
    } catch (error) {
      throw new AdoError(`Could not reach Azure DevOps: ${error instanceof Error ? error.message : 'network error'}.`)
    }
    // A bad token is often answered with the sign-in page (203, or a redirect) instead of a 401.
    const signIn = res.status === HTTP_OK_NON_AUTHORITATIVE || (res.status >= 300 && res.status < 400)
    if (res.status === HTTP_UNAUTHORIZED || signIn) {
      await this.onRejected()
      throw new TokenRejected()
    }
    if (res.status === HTTP_FORBIDDEN)
      throw new AdoForbidden('The token lacks a permission: it needs “Work Items: Read & write”.')
    if (res.status === HTTP_NOT_FOUND) throw new AdoNotFound(`${what} was not found in Azure DevOps.`)
    if (res.status === HTTP_CONFLICT || res.status === HTTP_PRECONDITION_FAILED) throw new ChangedMeanwhile()
    const body = (await res.json().catch(() => null)) as (T & { message?: string }) | null
    if (!res.ok) throw new AdoError(`Azure DevOps answered ${res.status}: ${body?.message ?? res.statusText}`)
    return body as T
  }

  /** Who the token acts as. */
  async whoAmI(): Promise<string> {
    const data = await this.request<{
      authenticatedUser?: { providerDisplayName?: string; customDisplayName?: string }
    }>(this.url('_apis/connectionData', { 'api-version': PREVIEW_API_VERSION }))
    const user = data.authenticatedUser
    return user?.customDisplayName || user?.providerDisplayName || 'Unknown user'
  }

  async getWorkItem(id: number): Promise<AdoWorkItemResponse> {
    return this.request(this.url(`_apis/wit/workitems/${id}`, { $expand: 'relations' }), {}, `Work item #${id}`)
  }

  /** The current revision of each item that exists; missing ones are left out. */
  async getRevisions(ids: number[]): Promise<Map<number, number>> {
    const revisions = new Map<number, number>()
    for (let at = 0; at < ids.length; at += MAX_IDS_PER_CALL) {
      const batch = ids.slice(at, at + MAX_IDS_PER_CALL)
      const query = { ids: batch.join(','), fields: 'System.Id,System.Rev', errorPolicy: 'omit' }
      const data = await this.request<{ value: (AdoWorkItemResponse | null)[] }>(this.url('_apis/wit/workitems', query))
      for (const item of data.value) if (item) revisions.set(item.id, item.rev)
    }
    return revisions
  }

  /** The project's Work Item Types and its own spelling (its root area's name); not found when it does not exist. */
  async lookupProject(project: string): Promise<BacklogLookup> {
    const base = encodeURIComponent(project)
    try {
      const area = await this.request<{ name: string }>(
        this.url(`${base}/_apis/wit/classificationnodes/areas`, { $depth: '0' }),
      )
      const types = await this.request<WorkItemTypesResponse>(this.url(`${base}/_apis/wit/workitemtypes`))
      return { found: true, name: area.name, types: types.value }
    } catch (error) {
      if (error instanceof AdoNotFound) return { found: false }
      throw error
    }
  }

  async createWorkItem(project: string, adoType: string, ops: PatchOperation[]): Promise<AdoWorkItemResponse> {
    const url = this.url(`${encodeURIComponent(project)}/_apis/wit/workitems/$${encodeURIComponent(adoType)}`)
    return this.request(url, { method: 'POST', body: JSON.stringify(ops), headers: patchHeaders })
  }

  /** Applies `ops`; a leading revision test makes Azure DevOps refuse it when the item changed meanwhile. */
  async updateWorkItem(id: number, ops: PatchOperation[]): Promise<AdoWorkItemResponse> {
    const url = this.url(`_apis/wit/workitems/${id}`)
    try {
      return await this.request(url, { method: 'PATCH', body: JSON.stringify(ops), headers: patchHeaders })
    } catch (error) {
      // A failed "test" operation is answered as a 400 naming the revision.
      if (error instanceof AdoError && /\brev\b|TF26071|TF401289/i.test(error.message)) throw new ChangedMeanwhile()
      throw error
    }
  }
}
