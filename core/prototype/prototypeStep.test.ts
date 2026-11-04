// Tests for the step a running Prototype shows (user story 64): derived from the session's messages, newest wins, and
// always one of a fixed set, never text from Claude.
import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '#core/session/sessionTypes.ts'

import { type PrototypeSession, prototypeSummaryOf } from './prototypeRecords.ts'
import { PROTOTYPE_SUBMIT_LABEL, prototypeStepOf, SUBMISSION_REFUSED_PREFIX } from './prototypeStep.ts'

let counter = 0
const tool = (name: string, summary: string): ChatMessage => ({
  id: `m${counter++}`,
  at: '',
  role: 'tool',
  tool: name,
  summary,
})
const system = (text: string, tone?: 'info' | 'success' | 'error'): ChatMessage => ({
  id: `m${counter++}`,
  at: '',
  role: 'system',
  text,
  ...(tone ? { tone } : {}),
})
const claude = (text: string): ChatMessage => ({
  id: `m${counter++}`,
  at: '',
  role: 'claude',
  segments: [{ type: 'text', text }],
})

describe('prototypeStepOf', () => {
  it('has no step before Claude has done anything', () => {
    expect(prototypeStepOf([])).toBeUndefined()
    expect(prototypeStepOf([system('Prototype Session started')])).toBeUndefined()
  })

  it.each(['Read', 'Grep', 'Glob'])('is reading after %s', (name) => {
    expect(prototypeStepOf([tool(name, 'Read draft.md')])).toBe('reading')
  })

  it('is writing after Write of prototype.html and editing after Edit or MultiEdit of it', () => {
    expect(prototypeStepOf([tool('Write', 'Wrote prototype.html')])).toBe('writing')
    expect(prototypeStepOf([tool('Edit', 'Wrote prototype.html')])).toBe('editing')
    expect(prototypeStepOf([tool('MultiEdit', 'Wrote prototype.html')])).toBe('editing')
  })

  it('ignores a write to any other file', () => {
    expect(prototypeStepOf([tool('Read', 'Read draft.md'), tool('Write', 'Wrote notes.md')])).toBe('reading')
  })

  it('is submitted after the submit command, and fixing once the submission was refused', () => {
    const submitted = tool('Bash', PROTOTYPE_SUBMIT_LABEL)
    expect(prototypeStepOf([submitted])).toBe('submitted')
    expect(prototypeStepOf([submitted, system(`${SUBMISSION_REFUSED_PREFIX} — no scripts`, 'error')])).toBe('fixing')
  })

  it('is editing again when Claude edits after a refusal', () => {
    const messages = [
      tool('Bash', PROTOTYPE_SUBMIT_LABEL),
      system(`${SUBMISSION_REFUSED_PREFIX} — no scripts`, 'error'),
      tool('Edit', 'Wrote prototype.html'),
    ]
    expect(prototypeStepOf(messages)).toBe('editing')
  })

  it('stays fixing when Claude reads prototype.html back after a refusal', () => {
    const messages = [
      tool('Write', 'Wrote prototype.html'),
      tool('Bash', PROTOTYPE_SUBMIT_LABEL),
      system(`${SUBMISSION_REFUSED_PREFIX} — no scripts`, 'error'),
      tool('Read', 'Read prototype.html'),
    ]
    expect(prototypeStepOf(messages)).toBe('fixing')
  })

  it('does not go back to reading once the page has been written, whatever is read', () => {
    const messages = [
      tool('Write', 'Wrote prototype.html'),
      tool('Bash', PROTOTYPE_SUBMIT_LABEL),
      system(`${SUBMISSION_REFUSED_PREFIX} — no scripts`, 'error'),
      tool('Grep', 'Searched images.md'),
    ]
    expect(prototypeStepOf(messages)).toBe('fixing')
  })

  it('does not call reading prototype.html, before any write, reading', () => {
    expect(prototypeStepOf([tool('Read', 'Read draft.md'), tool('Read', 'Read prototype.html')])).toBe('reading')
  })

  it('skips Claude’s text and other commands, keeping the last step', () => {
    const messages = [
      tool('Write', 'Wrote prototype.html'),
      claude('Done, checking.'),
      tool('Bash', 'Tried to run `ls`'),
    ]
    expect(prototypeStepOf(messages)).toBe('writing')
  })
})

const session = (patch: Partial<PrototypeSession>): PrototypeSession => ({
  id: 's',
  kind: 'prototype',
  projectId: 'p',
  draftId: 'd',
  draftVersion: 1,
  status: 'thinking',
  writeConfirmed: true,
  startedAt: '2026-10-25T10:00:00Z',
  inputs: { tickedImages: [], extraImages: [] },
  messages: [],
  ...patch,
})

describe('prototypeSummaryOf and the step', () => {
  it('carries the step of a running session, and none before there is one', () => {
    expect(prototypeSummaryOf(session({}))).not.toHaveProperty('step')
    const running = session({ messages: [tool('Write', 'Wrote prototype.html')] })
    expect(prototypeSummaryOf(running)).toMatchObject({ step: 'writing', startedAt: '2026-10-25T10:00:00Z' })
  })

  it('carries no step once the session has ended', () => {
    const ended = session({ status: 'failed', messages: [tool('Write', 'Wrote prototype.html')] })
    expect(prototypeSummaryOf(ended)).not.toHaveProperty('step')
  })
})
