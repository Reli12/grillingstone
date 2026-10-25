// Tests for the words a Prototype is named with: Draft version and time, and the short reason of a Failed row.
import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '#core/session/sessionTypes.ts'

import { lastMessageLines, prototypeLabel, shortReason, startedFromLabel } from '@/lib/prototypeLabel'

describe('prototypeLabel', () => {
  it('names the Draft version and the time it was written', () => {
    expect(prototypeLabel({ draftVersion: 2, writtenAt: '2026-10-25T10:04:00Z' })).toMatch(/^v2 · .*2026/)
  })
})

describe('startedFromLabel', () => {
  const at = '2026-10-25T10:04:00Z'
  const earlier = { id: 'p1', draftVersion: 1, writtenAt: at }
  const later = { id: 'p2', draftVersion: 2, writtenAt: at, startingPrototypeId: 'p1' }

  it('names the Prototype it started from by Draft version and time', () => {
    expect(startedFromLabel(later, [earlier, later])).toMatch(/^started from v1 · .*2026/)
  })

  it('says so when the Prototype it started from has been deleted', () => {
    expect(startedFromLabel(later, [later])).toBe('started from a deleted Prototype')
  })

  it('has nothing to say for a Prototype that started from scratch', () => {
    expect(startedFromLabel(earlier, [earlier, later])).toBeUndefined()
  })
})

describe('lastMessageLines', () => {
  const at = '2026-10-25T10:04:00Z'
  const messages: ChatMessage[] = [
    { id: 'm1', at, role: 'system', text: 'Prototype Session started' },
    { id: 'm2', at, role: 'tool', tool: 'Read', summary: 'Read draft.md' },
    {
      id: 'm3',
      at,
      role: 'claude',
      segments: [
        { type: 'text', text: 'Reading the Draft.' },
        { type: 'question', question: 'Ignored?', options: [] },
        { type: 'text', text: 'Then writing.' },
      ],
    },
    { id: 'm4', at, role: 'human', text: 'hello', kind: 'message' },
  ]

  it('turns each message into a line of text', () => {
    expect(lastMessageLines(messages, 10)).toEqual([
      { id: 'm1', text: 'Prototype Session started' },
      { id: 'm2', text: 'Read: Read draft.md' },
      { id: 'm3', text: 'Reading the Draft.\nThen writing.' },
      { id: 'm4', text: 'hello' },
    ])
  })

  it('keeps only the last few', () => {
    expect(lastMessageLines(messages, 2).map((line) => line.id)).toEqual(['m3', 'm4'])
  })

  it('leaves out a message with nothing to read', () => {
    const silent: ChatMessage = { id: 'm5', at, role: 'claude', segments: [] }
    expect(lastMessageLines([silent], 5)).toEqual([])
  })
})

describe('shortReason', () => {
  it('gives the first line of the error', () => {
    expect(shortReason('Claude Code exited with code 3\nstack trace…')).toBe('Claude Code exited with code 3')
  })

  it('cuts a very long line short', () => {
    const reason = shortReason('x'.repeat(500))
    expect(reason.length).toBeLessThan(200)
    expect(reason.endsWith('…')).toBe(true)
  })

  it('says something when the session recorded no error', () => {
    expect(shortReason(undefined)).toBe('The Prototype Session failed.')
    expect(shortReason('  \n ')).toBe('The Prototype Session failed.')
  })
})
