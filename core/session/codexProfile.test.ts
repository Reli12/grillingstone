// Tests for the Codex sandbox profile: what a session may read and write, and how it reaches app-server.
import { describe, expect, it } from 'vitest'

import { codexConfig, configArgs, type Profile } from './codexProfile.ts'

const input = {
  projectDir: '/p/project',
  mode: 'grilling' as const,
  sessionTmp: '/p/data/tmp/sess-1',
  runtimeReadPaths: ['/opt/node'],
}

/** The permission profile the config names as its default. */
const profileOf = (config: Record<string, unknown>) =>
  config[`permissions.${String(config.default_permissions)}`] as Profile

describe('codexConfig', () => {
  it('lets a Grilling Session read its Project and write only the Glossary and plan/', () => {
    const config = codexConfig(input)
    const profile = profileOf(config)
    expect(profile.workspace_roots).toEqual({ '/p/project': true })
    expect(profile.filesystem[':workspace_roots']).toEqual({ '.': 'read', 'CONTEXT.md': 'write', plan: 'write' })
  })

  it('lets a Template Session read its working folder and write none of it', () => {
    const config = codexConfig({ ...input, mode: 'template' })
    const profile = profileOf(config)
    expect(profile.filesystem[':workspace_roots']).toEqual({ '.': 'read' })
  })

  it('denies the rest of the disk, the system temp folders included, but reads the runtime and writes its own temp', () => {
    const config = codexConfig(input)
    const { filesystem } = profileOf(config)
    expect(filesystem).toMatchObject({
      ':root': 'deny',
      ':minimal': 'read',
      ':tmpdir': 'deny',
      ':slash_tmp': 'deny',
      '/opt/node': { '.': 'read' },
      '/p/data/tmp/sess-1': { '.': 'write' },
    })
  })

  it('points the shells at the session temp folder, keeps commands off the network and searches the web live', () => {
    const config = codexConfig(input)
    expect(config).toMatchObject({
      'shell_environment_policy.set.TMPDIR': '/p/data/tmp/sess-1',
      'shell_environment_policy.set.TMPPREFIX': '/p/data/tmp/sess-1/zsh',
      web_search: 'live',
    })
    const profile = profileOf(config)
    expect(profile).not.toHaveProperty('network')
  })
})

describe('configArgs', () => {
  it('passes each key as a -c override, with strings, booleans and tables written as TOML values', () => {
    expect(
      configArgs({ web_search: 'live', 'permissions.p': { workspace_roots: { '/a b': true }, x: { '.': 'read' } } }),
    ).toEqual([
      '-c',
      'web_search="live"',
      '-c',
      'permissions.p={ "workspace_roots" = { "/a b" = true }, "x" = { "." = "read" } }',
    ])
  })
})
