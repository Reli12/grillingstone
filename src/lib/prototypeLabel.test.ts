// Tests for the words a Prototype is named with: Draft version and time, and the short reason of a Failed row.
import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '#core/session/sessionTypes.ts'

import {
  createdFromLabel,
  elapsedLabel,
  lastMessageLines,
  prototypeLabel,
  roundLabel,
  shortReason,
  startedFromLabel,
  startingDraftLabel,
  startingPrototypeLabel,
  writerLabel,
} from '@/lib/prototypeLabel'

describe('elapsedLabel', () => {
  it.each([
    [0, '0s'],
    [42_000, '42s'],
    [185_000, '3m 05s'],
    [3_725_000, '1h 02m'],
  ])('writes %i ms as %s', (ms, label) => {
    expect(elapsedLabel(ms)).toBe(label)
  })

  it('never goes below zero when the clocks differ a little', () => {
    expect(elapsedLabel(-5000)).toBe('0s')
  })
})

describe('prototypeLabel', () => {
  it('names the Draft version and the time it was written', () => {
    expect(prototypeLabel({ draft: { draftVersion: 2 }, writtenAt: '2026-10-25T10:04:00Z' })).toMatch(/^v2 · .*2026/)
  })

  it('says "no Draft" for a Prototype that has none', () => {
    expect(prototypeLabel({ writtenAt: '2026-10-25T10:04:00Z' })).toMatch(/^no Draft · .*2026/)
  })
})

describe('writerLabel and roundLabel', () => {
  const grilling = { kind: 'prototypeGrilling' as const, sessionId: 's1', round: 2 }

  it('says which kind of session wrote a Prototype', () => {
    expect(writerLabel({ kind: 'prototype' })).toBe('Written by a Prototype Session')
    expect(writerLabel(grilling)).toBe('Written by a Prototype Grilling Session, round 2')
  })

  it('labels a version of a session by its round and, when it has one, its Draft version', () => {
    expect(roundLabel({ writtenBy: grilling, draft: { draftVersion: 3 } })).toBe('Round 2 · Draft v3')
    expect(roundLabel({ writtenBy: grilling })).toBe('Round 2')
  })
})

describe('starting labels of a session', () => {
  const at = '2026-10-25T10:04:00Z'

  it('names the starting Draft, or says there is none or that it is deleted', () => {
    expect(startingDraftLabel({ draftVersion: 2 }, 'Checkout flow')).toBe('Starting Draft: Checkout flow, v2')
    expect(startingDraftLabel({ draftVersion: 2 }, undefined)).toBe('Starting Draft: a deleted Draft, v2')
    expect(startingDraftLabel(undefined, undefined)).toBe('Starting Draft: none')
  })

  it('names the starting Prototype, or says there is none or that it is deleted', () => {
    const earlier = { id: 'p1', draft: { draftVersion: 1 }, writtenAt: at }
    expect(startingPrototypeLabel('p1', [earlier])).toMatch(/^Starting Prototype: v1 · .*2026/)
    expect(startingPrototypeLabel('p9', [earlier])).toBe('Starting Prototype: a deleted Prototype')
    expect(startingPrototypeLabel(undefined, [earlier])).toBe('Starting Prototype: none')
  })
})

describe('startedFromLabel', () => {
  const at = '2026-10-25T10:04:00Z'
  const earlier = { id: 'p1', draft: { draftVersion: 1 }, writtenAt: at }
  const later = { id: 'p2', draft: { draftVersion: 2 }, writtenAt: at, startingPrototypeId: 'p1' }

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

describe('createdFromLabel', () => {
  const at = '2026-10-25T10:04:00Z'
  const source = { id: 'p1', draft: { draftVersion: 1 }, writtenAt: at }

  it('names the Prototype a Draft was created from', () => {
    expect(createdFromLabel('p1', [source])).toMatch(/^Created from Prototype v1 · .*2026/)
  })

  it('says so when that Prototype has been deleted', () => {
    expect(createdFromLabel('p9', [source])).toBe('Created from a deleted Prototype')
  })

  it('has nothing to say for a Draft that was not created from a Prototype', () => {
    expect(createdFromLabel(undefined, [source])).toBeUndefined()
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
