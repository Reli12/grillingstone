// What test/server/fakeClaude.mjs and test/server/fakeCodex.mjs submit, so both fakes write the same Draft,
// Proposal or Template for the server and browser tests.
import { methodSkeleton } from '#core/template/templateValidator.ts'
import { validPbiContent } from '#core/testing/fixtures.ts'

/**
 * What a fake session submits: a Template in a Template Session; otherwise a valid v1 Draft, or, when the seed
 * holds a current Draft, a Proposal that revises its first prose Section.
 */
export function fakeSubmission(template, seed) {
  if (template)
    return {
      name: 'Spike PBI',
      method: methodSkeleton('Spike PBI'),
      sections: [
        {
          key: 'goal',
          heading: 'Goal',
          shape: 'prose',
          locked: true,
          guidance: 'What to find out',
          target: 'System.Description',
        },
      ],
    }
  const current = /## Current Draft[^\n]*\n```json\n([\s\S]*?)\n```/.exec(seed)
  if (!current) return validPbiContent()
  const prose = JSON.parse(current[1]).sections.find((section) => typeof section.body === 'string' && !section.entries)
  return {
    changes: [
      {
        kind: 'replaceSection',
        sectionId: prose.id,
        body: `${prose.body} (revised)`,
        label: `${prose.heading} · revise`,
      },
    ],
  }
}
