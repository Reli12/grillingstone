// Tests for reading Claude Code's stream-json events into chat messages and tool outcomes.
import { describe, expect, it } from 'vitest'

import { SUBMIT_SCRIPT } from '../config.ts'
import { describeTool, type KnownTool, readStreamEvent } from './streamEvents.ts'

const ctx = (tools = new Map<string, KnownTool>()) => ({ cwd: '/p', submitLabel: 'Submitted the Draft', tools })

describe('describeTool', () => {
  it('summarises each tool call relative to the working folder', () => {
    const summary = (name: string, input: Record<string, unknown>) => describeTool(name, input, ctx())
    expect(summary('Read', { file_path: '/p/drafts/a.md' })).toBe('Read drafts/a.md')
    expect(summary('Grep', { pattern: 'archive' })).toBe('Searched the Project for "archive"')
    expect(summary('Glob', { pattern: '**/*' })).toBe('Looked for files matching **/*')
    expect(summary('Edit', { file_path: '/p/CONTEXT.md' })).toBe('Updated the Glossary')
    expect(summary('Write', { file_path: '/p/plan/adr/1.md' })).toBe('Wrote plan/adr/1.md')
    expect(summary('WebSearch', { query: 'ADO' })).toBe('Searched the web for "ADO"')
    expect(summary('WebFetch', { url: 'https://x' })).toBe('Read https://x')
    expect(summary('Bash', { command: `node "${SUBMIT_SCRIPT}" <<'GRILLINGSTONE_JSON'` })).toBe('Submitted the Draft')
    expect(summary('Bash', { command: 'ls -la\nrm x' })).toBe('Tried to run `ls -la`')
    expect(summary('Skill', { skill: 'grill-with-docs' })).toBe('Loaded the grill-with-docs skill')
    expect(summary('TodoWrite', {})).toBeNull()
    expect(summary('Task', {})).toBe('Tried to use Task')
    expect(summary('Read', {})).toBe('Read ?')
  })
})

describe('readStreamEvent', () => {
  it("reads Claude Code's own session id from the init event", () => {
    expect(readStreamEvent({ type: 'system', subtype: 'init', session_id: 'claude-123' }, ctx())).toEqual([
      { type: 'claudeSession', id: 'claude-123' },
    ])
    expect(readStreamEvent({ type: 'system', subtype: 'other' }, ctx())).toEqual([])
  })

  it('turns Claude text into a message with cards, and a tool call into a tool message', () => {
    const steps = readStreamEvent(
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Q\n```pbi-ready\n{"summary": "Done"}\n```' },
            { type: 'text', text: '  ' },
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/p/CONTEXT.md' } },
            { type: 'tool_use', id: 't2', name: 'TodoWrite', input: {} },
          ],
        },
      },
      ctx(),
    )
    expect(steps).toHaveLength(2)
    expect(steps[0]).toMatchObject({
      type: 'message',
      message: { role: 'claude', segments: [{ type: 'text' }, { type: 'ready', summary: 'Done' }] },
    })
    expect(steps[1]).toMatchObject({
      type: 'message',
      toolUseId: 't1',
      tool: { name: 'Read' },
      message: { role: 'tool', summary: 'Read CONTEXT.md' },
    })
  })

  it('ignores sub-agent output', () => {
    expect(
      readStreamEvent(
        { type: 'assistant', parent_tool_use_id: 'x', message: { content: [{ type: 'text', text: 'hi' }] } },
        ctx(),
      ),
    ).toEqual([])
  })

  it('fills in tool outcomes: ok, denied by the guard, errors, refused submissions and Glossary edits', () => {
    const tools = new Map<string, KnownTool>([
      ['edit', { name: 'Edit', input: { file_path: '/p/CONTEXT.md' }, messageId: 'm1' }],
      ['bash', { name: 'Bash', input: {}, messageId: 'm2' }],
      ['read', { name: 'Read', input: {}, messageId: 'm3' }],
      ['web', { name: 'WebFetch', input: {}, messageId: 'm4' }],
    ])
    const result = (id: string, content: unknown, is_error = false) =>
      readStreamEvent(
        { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content, is_error }] } },
        ctx(tools),
      )
    expect(result('edit', 'ok')).toEqual([{ type: 'toolResult', messageId: 'm1', outcome: 'ok', glossaryEdited: true }])
    expect(result('bash', 'REFUSED\n- x')).toEqual([
      { type: 'toolResult', messageId: 'm2', outcome: 'error', glossaryEdited: false },
    ])
    expect(result('read', 'PreToolUse hook error: denied', true)[0]).toMatchObject({ outcome: 'denied' })
    expect(result('web', [{ type: 'text', text: 'timeout' }], true)[0]).toMatchObject({ outcome: 'error' })
    expect(result('unknown', 'ok')).toEqual([])
  })

  it('ends the turn, reporting an error result first', () => {
    expect(readStreamEvent({ type: 'result', is_error: false }, ctx())).toEqual([{ type: 'turnEnded' }])
    const failed = readStreamEvent({ type: 'result', is_error: true, subtype: 'error_max_turns' }, ctx())
    expect(failed[0]).toMatchObject({
      type: 'message',
      message: { tone: 'error', text: 'Claude Code reported an error: error_max_turns' },
    })
    expect(failed[1]).toEqual({ type: 'turnEnded' })
    expect(readStreamEvent({ type: 'system' }, ctx())).toEqual([])
  })
})
