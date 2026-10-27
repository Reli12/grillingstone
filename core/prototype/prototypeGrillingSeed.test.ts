// Tests for the seed a Prototype Grilling Session starts from: grill to a Ready Check, one submit per round, the
// starting Prototype's assumptions as questions, the one file it may write, and the current Draft winning on a
// Continuation.
import { describe, expect, it } from 'vitest'

import { buildPrototypeGrillingSeed, type PrototypeGrillingSeedInput } from '#core/prototype/prototypeGrillingSeed.ts'
import { READY_FENCE, WRITE_NOW_MESSAGE } from '#core/session/cardProtocol.ts'

const submitCommand = 'node "/tool/scripts/writeDraft.mjs"'

const seedText = (overrides: Partial<PrototypeGrillingSeedInput> = {}) => {
  const seed = buildPrototypeGrillingSeed({
    projectName: 'Customer Portal',
    draft: { title: 'Archive device from device list', version: 3 },
    hasImages: true,
    hasStartingPrototype: false,
    submitCommand,
    ...overrides,
  })
  return { ...seed, all: `${seed.systemPrompt}\n${seed.firstMessage}` }
}

describe('Prototype Grilling seed: grilling before writing', () => {
  it('grills the human on what the Prototype should show, one question at a time', () => {
    const { systemPrompt } = seedText()
    expect(systemPrompt).toMatch(/what the Prototype should show/i)
    expect(systemPrompt).toMatch(/exactly one question per message/i)
  })

  it('runs a Ready Check before the first write, and writes only after the human confirms or asks', () => {
    const { systemPrompt } = seedText()
    expect(systemPrompt).toContain(READY_FENCE)
    expect(systemPrompt).toContain(`"${WRITE_NOW_MESSAGE}"`)
    expect(systemPrompt).toMatch(/never write prototype\.html before the human confirms/i)
  })

  it('starts the conversation with a question and not with a Prototype', () => {
    expect(seedText().firstMessage).toMatch(/first question/i)
  })
})

describe('Prototype Grilling seed: rounds', () => {
  it('writes each clear message of feedback as the next Prototype, by editing prototype.html and submitting once', () => {
    const { systemPrompt } = seedText()
    expect(systemPrompt).toMatch(/each message of feedback that is clear enough/i)
    expect(systemPrompt).toMatch(/edit the existing prototype\.html/i)
    expect(systemPrompt).toMatch(/submit once per round/i)
  })

  it('asks a question instead when the feedback is ambiguous', () => {
    expect(seedText().systemPrompt).toMatch(/ambiguous[^.]*ask a question[^.]*instead of writing/i)
  })

  it('shows the submit command with the payload shape, and what a refusal means', () => {
    const { systemPrompt } = seedText()
    expect(systemPrompt).toContain(`${submitCommand} <<'GRILLINGSTONE_JSON'`)
    expect(systemPrompt).toContain('"prototype": "prototype.html"')
    expect(systemPrompt).toMatch(/REFUSED/)
  })

  it('keeps the page rules of the single-turn session: self-contained, Images only as images/N', () => {
    const { systemPrompt } = seedText()
    expect(systemPrompt).toMatch(/no external URLs, fonts or libraries/i)
    expect(systemPrompt).toContain('images/N')
  })

  it('requires every Prototype to list its own assumptions', () => {
    expect(seedText().systemPrompt).toMatch(/list(s)? every assumption|list each one/i)
  })
})

describe('Prototype Grilling seed: limits', () => {
  it('never touches anything but prototype.html', () => {
    expect(seedText().systemPrompt).toMatch(/never write anything but prototype\.html/i)
  })

  it('never changes the Draft, the Glossary or a Proposal, and leaves terms for a Draft’s session', () => {
    const { systemPrompt } = seedText()
    expect(systemPrompt).toMatch(/never change the Draft, the Glossary or a Proposal/i)
    expect(systemPrompt).toMatch(/Draft’s Grilling Session/i)
  })

  it('reads only what the human confirms in an Image', () => {
    expect(seedText().systemPrompt).toMatch(/put your reading to the human as a question/i)
  })
})

describe('Prototype Grilling seed: the starting Prototype', () => {
  it('has no starting-Prototype instructions without one', () => {
    const { all } = seedText()
    expect(all).not.toContain('start-assumptions.md')
    expect(all).not.toMatch(/starting Prototype/i)
  })

  it('treats its assumptions as questions to ask, not as settled', () => {
    const { all } = seedText({ hasStartingPrototype: true })
    expect(all).toContain('start-assumptions.md')
    expect(all).toMatch(/assumptions[^.]*are questions/i)
    expect(all).toMatch(/not settled/i)
  })
})

describe('Prototype Grilling seed: with and without a Draft', () => {
  it('names the Draft and its version, and where draft.md is', () => {
    const { firstMessage } = seedText()
    expect(firstMessage).toContain('Archive device from device list (v3)')
    expect(firstMessage).toContain('draft.md')
  })

  it('says there is no Draft, and points at no draft.md, when there is none', () => {
    const { firstMessage, all } = seedText({ draft: undefined })
    expect(firstMessage).toMatch(/no Draft/i)
    expect(firstMessage).not.toContain('draft.md')
    expect(all).not.toContain('v3')
  })

  it('mentions Images only when there are some', () => {
    expect(seedText({ hasImages: true }).firstMessage).toMatch(/image blocks/i)
    expect(seedText({ hasImages: false }).firstMessage).not.toMatch(/image blocks/i)
  })
})

describe('Prototype Grilling seed: a Continuation', () => {
  it('does not start the grilling over, and says the current Draft replaces anything said earlier', () => {
    const { firstMessage } = seedText({ continuing: true })
    expect(firstMessage).toMatch(/continues your earlier conversation/i)
    expect(firstMessage).toMatch(/Draft as it stands now replaces anything said earlier/i)
    expect(firstMessage).toMatch(/do not start the grilling over/i)
    expect(firstMessage).not.toMatch(/first question/i)
  })

  it('has no Draft line to prefer when there is no Draft', () => {
    const { firstMessage } = seedText({ continuing: true, draft: undefined })
    expect(firstMessage).toMatch(/continues your earlier conversation/i)
    expect(firstMessage).not.toMatch(/Draft as it stands now/i)
  })

  it('is not worded as a continuation on a fresh session', () => {
    expect(seedText().all).not.toMatch(/continues your earlier conversation/i)
  })
})
