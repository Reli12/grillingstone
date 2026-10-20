// Tests for the Codex sandbox profile: what a session may read and write, and how it reaches app-server.
import { describe, expect, it } from 'vitest'

import { codexConfig, configArgs, type Profile } from './codexProfile.ts'

const input = {
  projectDir: '/p/project',
  mode: 'grilling' as const,
  sessionTmp: '/p/data/tmp/sess-1',
  runtimeReadPaths: ['/opt/node'],
  platform: 'darwin' as const,
  codexHome: '/home/me/.codex',
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

  it('on Linux, lets a Grilling Session write its Project folder but not the app’s own files or instructions', () => {
    const config = codexConfig({ ...input, platform: 'linux' })
    const profile = profileOf(config)
    expect(profile.filesystem[':workspace_roots']).toEqual({
      '.': 'write',
      'project.json': 'read',
      drafts: 'read',
      transcripts: 'read',
      'AGENTS.md': 'deny',
      'AGENTS.override.md': 'deny',
    })
  })

  it('on Linux, reads the folder Codex starts its sandbox helper from, and no other part of its home', () => {
    const linux = profileOf(codexConfig({ ...input, platform: 'linux' })).filesystem
    expect(linux['/home/me/.codex/tmp/arg0']).toEqual({ '.': 'read' })
    expect(Object.keys(linux).filter((key) => key.startsWith('/home/me/.codex'))).toEqual(['/home/me/.codex/tmp/arg0'])
    const mac = profileOf(codexConfig(input)).filesystem
    expect(Object.keys(mac).some((key) => key.startsWith('/home/me/.codex'))).toBe(false)
  })

  it('on Linux too, lets a Template Session write none of its working folder', () => {
    const config = codexConfig({ ...input, mode: 'template', platform: 'linux' })
    expect(profileOf(config).filesystem[':workspace_roots']).toEqual({ '.': 'read' })
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
