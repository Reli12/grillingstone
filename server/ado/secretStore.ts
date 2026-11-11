// Secret Store: the only module that touches the Azure DevOps token at rest. One interface, a backend per platform:
// Windows — DPAPI-encrypted for the Windows user (through PowerShell, no native module) in the secrets file; macOS —
// the login Keychain through `security`, fed on stdin so the token never shows in a process list; Linux and Docker —
// an owner-only secrets file. A token in the environment wins over all of them and cannot be changed from the UI.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import { ADO_ORG_ENV, ADO_PAT_ENV, SECRETS_DIR } from '../config.ts'
import { readJson, writeFileAtomic } from '../storage/fsUtil.ts'

/** What the Connection keeps: the organization and the token. */
export interface Secrets {
  orgUrl: string
  token: string
}

export interface SecretStore {
  kind: 'environment' | 'windows' | 'macos' | 'file'
  /** Where the token is kept, as the Connection card says it. */
  description: string
  /** The token cannot be saved or cleared here (it comes from the environment). */
  readOnly: boolean
  read(): Promise<Secrets | null>
  write(secrets: Secrets): Promise<void>
  clear(): Promise<void>
}

/** The secrets file: the organization in the clear, the token as the backend stores it. */
interface SecretsFile {
  orgUrl: string
  /** File backend: the token itself. Windows: its DPAPI-protected form, base64. macOS: absent (Keychain). */
  token?: string
}

const OWNER_ONLY = 0o600
const OWNER_ONLY_DIR = 0o700
const KEYCHAIN_SERVICE = 'grillingstone-azure-devops'
const KEYCHAIN_ACCOUNT = 'personal-access-token'

/** Runs a command with `input` on stdin, so secrets never appear on a command line. */
export function runWithStdin(command: string, args: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    let out = ''
    let err = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (out += chunk))
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (err += chunk))
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0
        ? resolve(out)
        : reject(new Error(`${path.basename(command)} failed: ${err.trim() || `code ${code}`}`)),
    )
    child.stdin.end(input)
  })
}

export class FileSecretStore implements SecretStore {
  kind: SecretStore['kind'] = 'file'
  description = 'Saved in the tool’s data folder (secrets/), readable only by you.'
  readOnly = false
  protected file: string

  constructor(dir = SECRETS_DIR) {
    this.file = path.join(dir, 'connection.json')
  }

  protected protect(token: string): Promise<string | undefined> {
    return Promise.resolve(token)
  }

  protected unprotect(stored: string | undefined): Promise<string | null> {
    return Promise.resolve(stored ?? null)
  }

  async read(): Promise<Secrets | null> {
    const stored = await readJson<SecretsFile>(this.file)
    if (!stored?.orgUrl) return null
    const token = await this.unprotect(stored.token)
    return token ? { orgUrl: stored.orgUrl, token } : null
  }

  async write({ orgUrl, token }: Secrets) {
    await fs.mkdir(path.dirname(this.file), { recursive: true, mode: OWNER_ONLY_DIR })
    const protectedToken = await this.protect(token)
    const content: SecretsFile = { orgUrl, ...(protectedToken ? { token: protectedToken } : {}) }
    await writeFileAtomic(this.file, `${JSON.stringify(content, null, 2)}\n`)
    // Owner-only on POSIX; Windows ignores the mode, and protects the token with DPAPI instead.
    await fs.chmod(this.file, OWNER_ONLY).catch(() => undefined)
  }

  async clear() {
    await fs.rm(this.file, { force: true })
  }
}

/** The PowerShell that protects or unprotects stdin for the current Windows user. */
const dpapiScript = (direction: 'Protect' | 'Unprotect') => {
  const [from, to] =
    direction === 'Protect'
      ? ['[Text.Encoding]::UTF8.GetBytes($in)', '[Convert]::ToBase64String($out)']
      : ['[Convert]::FromBase64String($in)', '[Text.Encoding]::UTF8.GetString($out)']
  return `Add-Type -AssemblyName System.Security; $in = [Console]::In.ReadToEnd().Trim(); $out = [Security.Cryptography.ProtectedData]::${direction}(${from}, $null, 'CurrentUser'); [Console]::Out.Write(${to})`
}

export class WindowsSecretStore extends FileSecretStore {
  kind: SecretStore['kind'] = 'windows'
  description = 'Saved encrypted for your Windows user (DPAPI) in the tool’s data folder.'

  private powershell(direction: 'Protect' | 'Unprotect', input: string) {
    return runWithStdin('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', dpapiScript(direction)], input)
  }

  protected async protect(token: string) {
    return (await this.powershell('Protect', token)).trim()
  }

  protected async unprotect(stored: string | undefined) {
    return stored ? (await this.powershell('Unprotect', stored)).trim() || null : null
  }
}

/** `security` in interactive mode reads its commands on stdin, so the token is never an argument of a process. */
const quoted = (value: string) => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`

export class MacSecretStore extends FileSecretStore {
  kind: SecretStore['kind'] = 'macos'
  description = 'Saved in your macOS login Keychain.'

  protected async protect(token: string) {
    const command = `add-generic-password -U -a ${quoted(KEYCHAIN_ACCOUNT)} -s ${quoted(KEYCHAIN_SERVICE)} -w ${quoted(token)}\n`
    await runWithStdin('/usr/bin/security', ['-i'], command)
    return undefined
  }

  protected async unprotect(): Promise<string | null> {
    const args = ['find-generic-password', '-a', KEYCHAIN_ACCOUNT, '-s', KEYCHAIN_SERVICE, '-w']
    const token = await runWithStdin('/usr/bin/security', args, '').catch(() => '')
    return token.trim() || null
  }

  async clear() {
    const args = ['delete-generic-password', '-a', KEYCHAIN_ACCOUNT, '-s', KEYCHAIN_SERVICE]
    await runWithStdin('/usr/bin/security', args, '').catch(() => undefined)
    await super.clear()
  }
}

/** GRILLINGSTONE_ADO_PAT (with GRILLINGSTONE_ADO_ORG, or the organization saved before): read-only. */
export class EnvironmentSecretStore implements SecretStore {
  kind: SecretStore['kind'] = 'environment'
  description = `Using the token from ${ADO_PAT_ENV}. Unset it to manage the token here.`
  readOnly = true
  private env: NodeJS.ProcessEnv
  private fallback: SecretStore

  constructor(env: NodeJS.ProcessEnv, fallback: SecretStore) {
    this.env = env
    this.fallback = fallback
  }

  async read(): Promise<Secrets | null> {
    const token = this.env[ADO_PAT_ENV]?.trim()
    if (!token) return null
    const orgUrl =
      this.env[ADO_ORG_ENV]?.trim() || (await readJson<SecretsFile>(path.join(SECRETS_DIR, 'connection.json')))?.orgUrl
    return orgUrl ? { orgUrl, token } : null
  }

  write(): Promise<void> {
    return Promise.reject(new Error(`The token comes from ${ADO_PAT_ENV}; change it there.`))
  }

  clear(): Promise<void> {
    return Promise.reject(new Error(`The token comes from ${ADO_PAT_ENV}; unset it there.`))
  }

  /** Where a token would be saved once the variable is unset. */
  get savedStore() {
    return this.fallback
  }
}

/** The backend for this platform; the environment's token, when there is one, wins. */
export function platformSecretStore(platform = process.platform, env = process.env): SecretStore {
  let store: SecretStore
  if (platform === 'win32') store = new WindowsSecretStore()
  else if (platform === 'darwin') store = new MacSecretStore()
  else store = new FileSecretStore()
  return env[ADO_PAT_ENV]?.trim() ? new EnvironmentSecretStore(env, store) : store
}
