// Tests for the Prototype section of the Grilling seed: the confirmation rule, present only with Prototypes.
import { describe, expect, it } from 'vitest'

import { buildSeed } from '#core/session/grillingSeed.ts'
import { v1Draft } from '#core/testing/fixtures.ts'

const base = {
  kind: 'iteration' as const,
  draft: v1Draft(),
  projectName: 'Customer Portal',
  glossary: '',
  references: [],
  submitCommand: 'node "/tool/scripts/writeDraft.mjs"',
}

describe('Grilling seed with Prototypes', () => {
  it('is unchanged when no Prototype was given', () => {
    expect(buildSeed({ ...base, prototypeContext: '' })).toEqual(buildSeed(base))
  })

  it('states that nothing read in a Prototype counts until the human confirms it', () => {
    const { systemPrompt } = buildSeed({ ...base, prototypeContext: '## Prototypes\n### Prototype 1' })
    expect(systemPrompt).toContain('## Prototypes given as context')
    expect(systemPrompt).toContain('Only readings the human confirms count as observed')
    expect(systemPrompt).toContain('unsettled')
  })

  it('puts the rendered Prototypes in the first message', () => {
    const { firstMessage } = buildSeed({ ...base, prototypeContext: '## Prototypes\n### Prototype 1' })
    expect(firstMessage).toContain('### Prototype 1')
  })
})
