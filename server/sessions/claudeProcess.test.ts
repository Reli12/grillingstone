// Tests for the `claude -p` launch arguments and the stdout JSON-lines reader.
import { describe, expect, it } from 'vitest'

import { CODE_TOOLS_SERVER, SESSION_TOOLS } from '#core/session/permissionGuard.ts'

import { claudeArgs, jsonLines, sessionEnvironment } from './claudeProcess.ts'

describe('claudeArgs', () => {
  it('runs headless over stream-json with only the session tools and the guard hook', () => {
    const args = claudeArgs('RULES', '', { persist: false })
    expect(args.slice(0, 5)).toEqual(['-p', '--input-format', 'stream-json', '--output-format', 'stream-json'])
    expect(args[args.indexOf('--append-system-prompt') + 1]).toBe('RULES')
    expect(args[args.indexOf('--tools') + 1]).toBe(SESSION_TOOLS.join(','))
    expect(args).toContain('--no-session-persistence')
    expect(JSON.parse(args[args.indexOf('--settings') + 1]).hooks.PreToolUse[0].hooks[0].command).toContain(
      'permissionHook.mjs',
    )
    expect(args).not.toContain('--model')
    expect(claudeArgs('RULES', 'opus', { persist: false }).slice(-2)).toEqual(['--model', 'opus'])
  })

  it('keeps a Grilling Session so it can be continued, and continues one by its Claude Code id', () => {
    expect(claudeArgs('RULES', '', { persist: true })).not.toContain('--no-session-persistence')
    expect(claudeArgs('RULES', '', { persist: true })).not.toContain('--resume')
    const resumed = claudeArgs('RULES', '', { persist: true, resume: 'claude-123' })
    expect(resumed[resumed.indexOf('--resume') + 1]).toBe('claude-123')
  })
})

describe('sessionEnvironment', () => {
  it('never passes the Connection’s token or organization to a session', () => {
    const env = sessionEnvironment({ PATH: '/bin', GRILLINGSTONE_ADO_PAT: 'secret', GRILLINGSTONE_ADO_ORG: 'org' })
    expect(env).toEqual({ PATH: '/bin' })
  })
})

describe('jsonLines', () => {
  it('parses complete JSON lines across chunks and skips the rest', () => {
    const events: unknown[] = []
    const feed = jsonLines((event) => events.push(event))
    feed('{"a":1}\n{"b"')
    feed(':2}\n\nnot json\n{"c":3')
    expect(events).toEqual([{ a: 1 }, { b: 2 }])
    feed('}\n')
    expect(events).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
  })
})

describe('claudeArgs — code tools (ADR-0016)', () => {
  it('starts no MCP server for a session that reads no Code Folders', () => {
    expect(claudeArgs('RULES', '', { persist: true })).not.toContain('--mcp-config')
    expect(claudeArgs('RULES', '', { persist: true }, false)).not.toContain('--mcp-config')
  })

  it('starts the code tools server, and only it, for a session that reads Code Folders', () => {
    const args = claudeArgs('RULES', '', { persist: true }, true)
    expect(args).toContain('--strict-mcp-config')
    const config = JSON.parse(args[args.indexOf('--mcp-config') + 1])
    expect(Object.keys(config.mcpServers)).toEqual([CODE_TOOLS_SERVER])
    expect(config.mcpServers[CODE_TOOLS_SERVER].args[0]).toMatch(/codeTools\.mjs$/)
  })
})
