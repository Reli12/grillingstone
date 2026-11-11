// Tests for the Secret Store's file and environment backends (the Windows and macOS ones run only on their platform).
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { EnvironmentSecretStore, FileSecretStore, platformSecretStore, WindowsSecretStore } from './secretStore.ts'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gs-secrets-'))
})
afterEach(() => fs.rm(dir, { recursive: true, force: true }))

describe('Secret Store', () => {
  it('keeps the token in an owner-only file and clears it', async () => {
    const store = new FileSecretStore(dir)
    expect(await store.read()).toBeNull()
    await store.write({ orgUrl: 'https://dev.azure.com/acme', token: 't0ken' })
    expect(await store.read()).toEqual({ orgUrl: 'https://dev.azure.com/acme', token: 't0ken' })
    if (process.platform !== 'win32')
      expect((await fs.stat(path.join(dir, 'connection.json'))).mode & 0o777).toBe(0o600)
    await store.clear()
    expect(await store.read()).toBeNull()
  })

  it('lets the environment’s token win, read-only', async () => {
    const env = { GRILLINGSTONE_ADO_PAT: 'from-env', GRILLINGSTONE_ADO_ORG: 'https://dev.azure.com/acme' }
    const store = platformSecretStore('linux', env)
    expect(store).toBeInstanceOf(EnvironmentSecretStore)
    expect(store.readOnly).toBe(true)
    expect(await store.read()).toEqual({ orgUrl: 'https://dev.azure.com/acme', token: 'from-env' })
    await expect(store.write({ orgUrl: 'x', token: 'y' })).rejects.toThrow('GRILLINGSTONE_ADO_PAT')
    expect(platformSecretStore('linux', {})).toBeInstanceOf(FileSecretStore)
  })

  it.runIf(process.platform === 'win32')('encrypts the token with DPAPI on Windows', async () => {
    const store = new WindowsSecretStore(dir)
    await store.write({ orgUrl: 'https://dev.azure.com/acme', token: 'plain-token' })
    expect(await fs.readFile(path.join(dir, 'connection.json'), 'utf8')).not.toContain('plain-token')
    expect(await store.read()).toEqual({ orgUrl: 'https://dev.azure.com/acme', token: 'plain-token' })
  })
})
