import { describe, expect, it } from 'vitest'
import { addTerm, parseGlossary, removeTerm, startingGlossary, updateTerm, withoutTitle } from '#core/glossary/glossary.ts'

const md = `# Customer Portal

Devices and billing for smart energy.

## Language

**Archived Device**:
A device hidden from dashboards, still billed up to its archive timestamp.
_Avoid_: deleted, inactive

### Sites

**Site Owner**:
The customer contact responsible for all devices at one site.
_Avoid_: site admin

## Example dialogue

> **Dev:** "Is an **Archived Device** billed?"
`

describe('Glossary (CONTEXT.md)', () => {
  it('reads the terms under Language, including sub-headings, and ignores bold text elsewhere', () => {
    expect(parseGlossary(md)).toEqual([
      { term: 'Archived Device', definition: 'A device hidden from dashboards, still billed up to its archive timestamp.', avoid: 'deleted, inactive' },
      { term: 'Site Owner', definition: 'The customer contact responsible for all devices at one site.', avoid: 'site admin' },
    ])
  })

  it('edits one term in place and leaves the rest of the document untouched', () => {
    const next = updateTerm(md, 1, { term: 'Site Owner', definition: 'The one contact accountable for a site.', avoid: '' })
    expect(parseGlossary(next)[1]).toEqual({ term: 'Site Owner', definition: 'The one contact accountable for a site.', avoid: '' })
    expect(next).toContain('## Example dialogue')
    expect(next).toContain('### Sites')
    expect(next.replace(/\*\*Site Owner\*\*:[\s\S]*?(?=\n## )/, '')).toBe(md.replace(/\*\*Site Owner\*\*:[\s\S]*?(?=\n## )/, ''))
  })

  it('adds a term at the end of Language, creating the document when there is none', () => {
    const added = addTerm(md, { term: 'Decommissioned Device', definition: 'Permanently removed from service.', avoid: 'retired' })
    expect(parseGlossary(added).map((t) => t.term)).toEqual(['Archived Device', 'Site Owner', 'Decommissioned Device'])
    expect(added.indexOf('Decommissioned')).toBeLessThan(added.indexOf('## Example dialogue'))
    const fresh = addTerm('', { term: 'Site', definition: 'A physical location.', avoid: '' }, 'Customer Portal')
    expect(fresh).toContain('# Customer Portal')
    expect(parseGlossary(fresh)).toEqual([{ term: 'Site', definition: 'A physical location.', avoid: '' }])
  })

  it('removes a term', () => {
    expect(parseGlossary(removeTerm(md, 0)).map((t) => t.term)).toEqual(['Site Owner'])
  })

  it('reads a definition written on the term line itself', () => {
    const inline = '# X\n\n## Language\n\n**Show archived filter**: A filter that lists archived devices.\nNot on dashboards.\n_Avoid_: toggle\n'
    expect(parseGlossary(inline)).toEqual([{ term: 'Show archived filter', definition: 'A filter that lists archived devices. Not on dashboards.', avoid: 'toggle' }])
  })
})

describe('startingGlossary', () => {
  it('keeps everything under the title and titles it with the new Project name', () => {
    const start = startingGlossary('Billing Platform', md)
    expect(start.split('\n')[0]).toBe('# Billing Platform')
    expect(start).not.toContain('# Customer Portal')
    expect(start).toContain('Devices and billing for smart energy.')
    expect(parseGlossary(start).map((t) => t.term)).toEqual(['Archived Device', 'Site Owner'])
  })

  it('adds the title to text that has none, and keeps any format', () => {
    expect(startingGlossary('Billing', '\n\nInvoice - a request for payment\n')).toBe('# Billing\n\nInvoice - a request for payment\n')
  })

  it('starts empty when there is nothing to start from', () => {
    expect(startingGlossary('Billing', '  \n')).toBe('')
    expect(startingGlossary('Billing', '# Only a title\n')).toBe('')
  })

  it('drops only a leading top-level title', () => {
    expect(withoutTitle('\n# Old\n\nBody\n## Language')).toBe('Body\n## Language')
    expect(withoutTitle('## Language\n**A**:\nx')).toBe('## Language\n**A**:\nx')
  })
})
