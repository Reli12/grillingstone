// The Connection: the tool's one way into the one Azure DevOps organization. "Test & save" stores nothing until
// Azure DevOps accepts the token; any 401 from any caller marks the token rejected until it is replaced. The browser
// only ever learns the status, never the token.
import type { ConnectionState, ConnectionStatus } from '#core/ado/adoTypes.ts'
import { parseOrganization } from '#core/ado/workItemAddress.ts'

import { SECRETS_DIR } from '../config.ts'
import type { Hub } from '../hub.ts'
import { now } from '../services/clock.ts'
import { readJson, writeJson } from '../storage/fsUtil.ts'
import { AdoClient, type FetchLike, TokenRejected } from './adoClient.ts'
import { EnvironmentSecretStore, platformSecretStore, type SecretStore } from './secretStore.ts'

/** A refusal of what the human entered in the Connection card. */
export class ConnectionError extends Error {}
/** Azure DevOps is needed but there is no Connection, or its token is rejected. */
export class NotConnected extends Error {}

/** What the card shows about the token without holding it: who it is, when it was checked, whether it was refused. */
interface StatusFile {
  user?: string
  checkedAt?: string
  rejected?: boolean
}

export class ConnectionService {
  private store: SecretStore
  private fetch: FetchLike | undefined
  private hub: Hub | undefined
  private statusFile: string

  constructor(opts: { store?: SecretStore; fetch?: FetchLike; hub?: Hub; secretsDir?: string } = {}) {
    this.store = opts.store ?? platformSecretStore()
    this.fetch = opts.fetch
    this.hub = opts.hub
    this.statusFile = `${opts.secretsDir ?? SECRETS_DIR}/status.json`
  }

  private async readStatus(): Promise<StatusFile> {
    return (await readJson<StatusFile>(this.statusFile)) ?? {}
  }

  private async writeStatus(status: StatusFile) {
    await writeJson(this.statusFile, status)
    this.hub?.broadcast({ type: 'connection' })
  }

  private clientFor(orgUrl: string, token: string) {
    return new AdoClient({
      orgUrl,
      token,
      ...(this.fetch ? { fetch: this.fetch } : {}),
      onRejected: () => this.markRejected(),
    })
  }

  private async markRejected() {
    const status = await this.readStatus()
    if (!status.rejected) await this.writeStatus({ ...status, rejected: true })
  }

  private storageDescription() {
    return this.store instanceof EnvironmentSecretStore ? this.store.savedStore.description : this.store.description
  }

  async status(): Promise<ConnectionStatus> {
    const secrets = await this.store.read()
    const fromEnvironment = this.store.readOnly
    const base = { fromEnvironment, storage: this.storageDescription() }
    if (!secrets) return { state: 'none', ...base }
    const organization = parseOrganization(secrets.orgUrl)
    let saved = await this.readStatus()
    // A token from the environment was never tested through the card: check it once to learn who it is.
    if (fromEnvironment && !saved.user && !saved.rejected) saved = await this.check(secrets.orgUrl, secrets.token)
    return {
      state: saved.rejected ? 'rejected' : 'connected',
      orgUrl: secrets.orgUrl,
      ...(organization.ok ? { organization: organization.organization } : {}),
      ...(saved.user ? { user: saved.user } : {}),
      ...(saved.checkedAt ? { checkedAt: saved.checkedAt } : {}),
      ...base,
    }
  }

  /** Who the token is, saved as the status; a refused token is saved as rejected. */
  private async check(orgUrl: string, token: string): Promise<StatusFile> {
    try {
      const user = await this.clientFor(orgUrl, token).whoAmI()
      const status = { user, checkedAt: now() }
      await this.writeStatus(status)
      return status
    } catch (error) {
      if (error instanceof TokenRejected) return { ...(await this.readStatus()), rejected: true }
      return this.readStatus()
    }
  }

  async state(): Promise<ConnectionState> {
    return (await this.status()).state
  }

  /** Checks the URL and token against Azure DevOps and saves them only if it accepts them. */
  async testAndSave(orgInput: string, token: string): Promise<ConnectionStatus> {
    if (this.store.readOnly) throw new ConnectionError('The token comes from the environment; change it there.')
    const organization = parseOrganization(orgInput)
    if (!organization.ok) throw new ConnectionError(organization.reason)
    const pat = token.trim()
    if (!pat) throw new ConnectionError('Paste a Personal Access Token.')
    let user: string
    try {
      // Tested on a client that does not mark the saved token rejected: nothing is saved yet.
      user = await new AdoClient({
        orgUrl: organization.orgUrl,
        token: pat,
        ...(this.fetch ? { fetch: this.fetch } : {}),
      }).whoAmI()
    } catch (error) {
      if (error instanceof TokenRejected)
        throw new ConnectionError('Azure DevOps rejected this token for that organization — nothing was saved.')
      throw new ConnectionError(`${error instanceof Error ? error.message : 'The check failed'} Nothing was saved.`)
    }
    await this.store.write({ orgUrl: organization.orgUrl, token: pat })
    await this.writeStatus({ user, checkedAt: now() })
    return this.status()
  }

  async disconnect(): Promise<ConnectionStatus> {
    if (this.store.readOnly) throw new ConnectionError('The token comes from the environment; unset it there.')
    await this.store.clear()
    await this.writeStatus({})
    return this.status()
  }

  /** A client acting as the token's owner; refused without a Connection or while its token is rejected. */
  async client(): Promise<AdoClient> {
    const secrets = await this.store.read()
    if (!secrets) throw new NotConnected('Set up the Connection to Azure DevOps in Settings first.')
    if ((await this.readStatus()).rejected)
      throw new NotConnected(
        'Azure DevOps rejected the token — it may have expired or been revoked. Replace it in Settings.',
      )
    return this.clientFor(secrets.orgUrl, secrets.token)
  }

  /** The connected organization's name, for checking links; null without a Connection. */
  async organization(): Promise<string | null> {
    const secrets = await this.store.read()
    const parsed = secrets ? parseOrganization(secrets.orgUrl) : null
    return parsed?.ok ? parsed.organization : null
  }
}
