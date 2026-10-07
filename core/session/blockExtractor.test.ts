import { describe, expect, it } from 'vitest'

import { extractBlocks } from '#core/session/blockExtractor.ts'

const fence = '```'

describe('Block extractor', () => {
  it('keeps plain text as text', () => {
    expect(extractBlocks('Hello there.')).toEqual([{ type: 'text', text: 'Hello there.' }])
  })

  it('turns a question block into a question card, keeping the lead-in text', () => {
    const text = `Your Glossary has three roles.\n\n${fence}pbi-question\n{"question": "Who may archive?", "recommended": "Admin and Manager", "options": ["Admin only", "Everyone"]}\n${fence}\n`
    expect(extractBlocks(text)).toEqual([
      { type: 'text', text: 'Your Glossary has three roles.' },
      {
        type: 'question',
        question: 'Who may archive?',
        recommended: 'Admin and Manager',
        options: ['Admin only', 'Everyone'],
      },
    ])
  })

  it('turns a ready block into a Ready Check', () => {
    expect(extractBlocks(`${fence}pbi-ready\n{"summary": "One AC per role."}\n${fence}`)).toEqual([
      { type: 'ready', summary: 'One AC per role.' },
    ])
  })

  it('falls back to plain text for malformed or incomplete blocks instead of dropping them', () => {
    const broken = `${fence}pbi-question\n{"question": "Who may archive?", "recommended": \n${fence}`
    const missing = `${fence}pbi-question\n{"question": "Who?"}\n${fence}`
    const unknown = `${fence}pbi-poll\n{"a": 1}\n${fence}`
    for (const t of [broken, missing, unknown]) expect(extractBlocks(t)).toEqual([{ type: 'text', text: t }])
  })

  it('leaves ordinary code blocks inside the text', () => {
    const t = `Like this:\n${fence}ts\nconst a = 1\n${fence}\nDone.`
    expect(extractBlocks(t)).toEqual([{ type: 'text', text: t }])
  })

  it('tolerates missing options and a trailing unclosed fence while streaming', () => {
    expect(extractBlocks(`${fence}pbi-question\n{"question": "Q?", "recommended": "R"}\n${fence}`)).toEqual([
      { type: 'question', question: 'Q?', recommended: 'R', options: [] },
    ])
    const partial = `Thinking…\n${fence}pbi-question\n{"question": "Q?"`
    expect(extractBlocks(partial)).toEqual([{ type: 'text', text: partial }])
  })
})
