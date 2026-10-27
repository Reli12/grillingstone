// Tests for the `claude -p` launch arguments and the stdout JSON-lines reader.
import { spawn } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { SESSION_TOOLS } from '#core/session/permissionGuard.ts'

import { claudeArgs, ignoreBrokenPipe, jsonLines, sendMessage } from './claudeProcess.ts'

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

describe('sendMessage to a child that has gone', () => {
  it('does not raise an unhandled error when the write meets a closed pipe', async () => {
    const child = ignoreBrokenPipe(spawn(process.execPath, ['-e', '']))
    await new Promise((resolve) => child.once('exit', resolve))

    expect(() => sendMessage(child, 'too late')).not.toThrow()
    // A write to a closed pipe fails on a later tick; without a listener that 'error' would be uncaught.
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(child.stdin?.listenerCount('error')).toBeGreaterThan(0)
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
