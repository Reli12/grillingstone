// Tests for the seed a Prototype Session starts from: its limits, its rules and the starting-Prototype instructions.
import { describe, expect, it } from 'vitest'

import { buildPrototypeSeed, type PrototypeSeedInput } from '#core/prototype/prototypeSeed.ts'

const submitCommand = 'node "/tool/scripts/writeDraft.mjs"'

const seedText = (overrides: Partial<PrototypeSeedInput> = {}) => {
  const seed = buildPrototypeSeed({
    projectName: 'Customer Portal',
    draftTitle: 'Archive device from device list',
    draftVersion: 3,
    hasImages: true,
    hasStartingPrototype: false,
    submitCommand,
    ...overrides,
  })
  return { ...seed, all: `${seed.systemPrompt}\n${seed.firstMessage}` }
}

describe('Prototype seed', () => {
  it('states the job: one interactive HTML Prototype of this Draft, in a single turn, never asking', () => {
    const { systemPrompt } = seedText()
    expect(systemPrompt).toMatch(/single turn/i)
    expect(systemPrompt).toMatch(/never ask/i)
    expect(systemPrompt).toContain('prototype.html')
    expect(systemPrompt).toMatch(/never write anything (else|but)/i)
  })

  it('names the Project, the Draft and its version, and where each file is', () => {
    const { firstMessage } = seedText()
    expect(firstMessage).toContain('Customer Portal')
    expect(firstMessage).toContain('Archive device from device list')
    expect(firstMessage).toContain('v3')
    for (const file of ['draft.md', 'CONTEXT.md', 'images.md']) expect(firstMessage).toContain(file)
  })

  it('tells Claude to match the look of Images of existing screens first, and to take wording from the Draft and Glossary', () => {
    const { systemPrompt } = seedText()
    expect(systemPrompt).toMatch(/match the look of the Images/i)
    expect(systemPrompt).toMatch(/wording from the Draft and the Glossary/i)
  })

  it('makes every non-Discarded Acceptance Criterion reachable with a visible outcome', () => {
    const { systemPrompt } = seedText()
    expect(systemPrompt).toMatch(/each Acceptance Criterion/i)
    expect(systemPrompt).toMatch(/reachable/i)
    expect(systemPrompt).toMatch(/outcome/i)
  })

  it('forbids external URLs, fonts and libraries, and says Images are referred to only as images/N', () => {
    const { systemPrompt } = seedText()
    expect(systemPrompt).toMatch(/no external URLs, fonts or libraries/i)
    expect(systemPrompt).toContain('images/N')
    expect(systemPrompt).toMatch(/without a file extension/i)
  })

  it('defines what counts as an assumption', () => {
    const { systemPrompt } = seedText()
    for (const topic of ['layout', 'sample data', 'wording', 'empty and error states', 'navigation'])
      expect(systemPrompt).toContain(topic)
  })

  it('shows the submit command with the payload shape, and what a refusal means', () => {
    const { systemPrompt } = seedText()
    expect(systemPrompt).toContain(`${submitCommand} <<'GRILLINGSTONE_JSON'`)
    expect(systemPrompt).toContain('"prototype": "prototype.html"')
    expect(systemPrompt).toContain('"assumptions"')
    expect(systemPrompt).toMatch(/REFUSED/)
    expect(systemPrompt).toMatch(/Edit/)
  })

  it('does not use the grilling card protocol', () => {
    const { all } = seedText()
    expect(all).not.toContain('pbi-question')
    expect(all).not.toContain('Write it now.')
  })

  it('mentions Images only when there are some', () => {
    expect(seedText({ hasImages: true }).firstMessage).toMatch(/image blocks/i)
    expect(seedText({ hasImages: false }).firstMessage).not.toMatch(/image blocks/i)
  })

  it('has no starting-Prototype instructions without a starting Prototype', () => {
    const { all } = seedText()
    expect(all).not.toContain('start-assumptions.md')
    expect(all).not.toMatch(/starting Prototype/i)
  })

  it('tells Claude to edit the existing file, keep its structure and look, and revise the starting assumptions', () => {
    const { all } = seedText({ hasStartingPrototype: true })
    expect(all).toContain('start-assumptions.md')
    expect(all).toMatch(/edit the existing prototype\.html/i)
    expect(all).toMatch(/keep its structure and look/i)
    expect(all).toMatch(/keep the assumptions that still hold/i)
    expect(all).toMatch(/drop the ones the Draft now settles/i)
    expect(all).toMatch(/kept from the starting Prototype/i)
  })
})
