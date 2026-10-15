// Tests for reading Codex app-server notifications into chat messages and tool outcomes.
import { describe, expect, it } from 'vitest'

import { readCodexNotification } from './codexEvents.ts'
import type { KnownTool } from './streamEvents.ts'

const ctx = (tools = new Map<string, KnownTool>()) => ({ cwd: '/p', submitLabel: 'Submitted the Draft', tools })

const completed = (item: Record<string, unknown>) => ['item/completed', { item }] as const

/** Reads a started item, remembers its tool message as the adapter does, and returns that message's summary. */
function startedSummary(item: Record<string, unknown>, tools: Map<string, KnownTool>) {
  const [step] = readCodexNotification('item/started', { item }, ctx(tools))
  if (step?.type === 'message' && step.toolUseId && step.tool) tools.set(step.toolUseId, step.tool)
  return step?.type === 'message' && step.message.role === 'tool' ? step.message.summary : undefined
}

describe('readCodexNotification', () => {
  it('turns a finished agent message into a message with cards', () => {
    const text = 'One question.\n```pbi-question\n{"question": "Who may archive?", "options": ["Admins"]}\n```'
    const steps = readCodexNotification(...completed({ type: 'agentMessage', id: 'a1', text }), ctx())
    expect(steps).toEqual([
      {
        type: 'message',
        message: expect.objectContaining({
          role: 'claude',
          segments: [{ type: 'text', text: 'One question.' }, expect.objectContaining({ type: 'question' })],
        }),
      },
    ])
  })

  it('shows a command in plain words when it starts, and its outcome when it ends', () => {
    const tools = new Map<string, KnownTool>()
    const command = (id: string, commandActions: unknown[]) => ({
      type: 'commandExecution',
      id,
      command: '/bin/zsh -lc "…"',
      commandActions,
      status: 'inProgress',
    })
    const summaryOf = (item: Record<string, unknown>) => startedSummary(item, tools)

    expect(summaryOf(command('c1', [{ type: 'read', command: 'cat x', name: 'a.md', path: '/p/docs/a.md' }]))).toBe(
      'Read docs/a.md',
    )
    expect(summaryOf(command('c2', [{ type: 'search', command: 'rg', query: 'Archived Device', path: null }]))).toBe(
      'Searched the Project for "Archived Device"',
    )
    expect(summaryOf(command('c3', [{ type: 'listFiles', command: 'ls', path: 'docs' }]))).toBe(
      'Listed the files in docs',
    )
    expect(summaryOf(command('c4', [{ type: 'unknown', command: 'python3 x.py\nmore' }]))).toBe('Ran `python3 x.py`')

    const outcome = (id: string, status: string) => {
      const [step] = readCodexNotification(...completed({ type: 'commandExecution', id, status }), ctx(tools))
      return step?.type === 'toolResult' ? step.outcome : undefined
    }
    expect(outcome('c1', 'completed')).toBe('ok')
    expect(outcome('c2', 'declined')).toBe('denied')
    expect(outcome('c3', 'failed')).toBe('error')
  })

  it('shows a command the sandbox stopped as refused rather than failed', () => {
    const tools = new Map<string, KnownTool>([['c1', { name: 'commandExecution', input: {}, messageId: 'm1' }]])
    const item = {
      type: 'commandExecution',
      id: 'c1',
      status: 'failed',
      exitCode: 1,
      aggregatedOutput: 'cat: /Users/me/.ssh/id_rsa: Operation not permitted\n',
    }
    expect(readCodexNotification(...completed(item), ctx(tools))).toEqual([
      { type: 'toolResult', messageId: 'm1', outcome: 'denied', glossaryEdited: false },
    ])
  })

  it('shows file changes by what they touch, and reports an applied Glossary change as a Glossary edit', () => {
    const tools = new Map<string, KnownTool>()
    const change = (id: string, file: string) => ({
      type: 'fileChange',
      id,
      changes: [{ path: file, kind: { type: 'update' }, diff: '' }],
      status: 'inProgress',
    })
    const start = (item: Record<string, unknown>) => startedSummary(item, tools)
    expect(start(change('f1', '/p/CONTEXT.md'))).toBe('Updated the Glossary')
    expect(start(change('f2', 'plan/adr/0001-x.md'))).toBe('Wrote plan/adr/0001-x.md')
    start(change('f3', 'CONTEXT.md'))

    const end = (id: string, status: string) =>
      readCodexNotification(...completed({ ...change(id, ''), status }), ctx(tools))
    expect(end('f1', 'completed')).toEqual([expect.objectContaining({ outcome: 'ok', glossaryEdited: true })])
    expect(end('f3', 'declined')).toEqual([expect.objectContaining({ outcome: 'denied', glossaryEdited: false })])
    expect(end('f2', 'completed')).toEqual([expect.objectContaining({ outcome: 'ok', glossaryEdited: false })])
  })

  it('shows a finished web search, or a page Codex opened, as one done tool message', () => {
    const search = (action: Record<string, unknown>) => {
      const [step] = readCodexNotification(...completed({ type: 'webSearch', id: 'w1', query: 'q', action }), ctx())
      return step?.type === 'message' ? step.message : undefined
    }
    expect(search({ type: 'search', query: 'ADO work item fields' })).toMatchObject({
      role: 'tool',
      summary: 'Searched the web for "ADO work item fields"',
      outcome: 'ok',
    })
    expect(search({ type: 'openPage', url: 'https://learn.microsoft.com/x' })).toMatchObject({
      summary: 'Read https://learn.microsoft.com/x',
    })
  })

  it('shows the submit_draft call with the submit label, and a refused submission as an error', () => {
    const tools = new Map<string, KnownTool>()
    const call = (id: string) => ({ type: 'dynamicToolCall', id, tool: 'submit_draft', arguments: {} })
    expect(startedSummary({ ...call('d1'), status: 'inProgress' }, tools)).toBe('Submitted the Draft')
    startedSummary({ ...call('d2'), status: 'inProgress' }, tools)

    const end = (id: string, success: boolean) =>
      readCodexNotification(...completed({ ...call(id), status: 'completed', success }), ctx(tools))
    expect(end('d1', true)).toEqual([expect.objectContaining({ type: 'toolResult', outcome: 'ok' })])
    expect(end('d2', false)).toEqual([expect.objectContaining({ type: 'toolResult', outcome: 'error' })])
  })

  it('ends the turn, reporting first when Codex failed it', () => {
    const ended = (turn: Record<string, unknown>) =>
      readCodexNotification('turn/completed', { threadId: 't', turn }, ctx())
    expect(ended({ id: 'u1', status: 'completed' })).toEqual([{ type: 'turnEnded' }])
    expect(ended({ id: 'u1', status: 'interrupted' })).toEqual([{ type: 'turnEnded' }])
    expect(ended({ id: 'u1', status: 'failed', error: { message: 'usage limit reached' } })).toEqual([
      {
        type: 'message',
        message: expect.objectContaining({
          role: 'system',
          tone: 'error',
          text: 'Codex reported an error: usage limit reached',
        }),
      },
      { type: 'turnEnded' },
    ])
  })
})
