// Tests for the Backlog Copy: reading a work item ID however it was pasted, creating, re-pasting and what changed.
import { describe, expect, it } from 'vitest'

import {
  type BacklogCopy,
  backlogCopyChanges,
  backlogCopyMarkdown,
  createBacklogCopy,
  parseWorkItemId,
  repasteBacklogCopy,
} from '#core/backlog/backlogCopy.ts'

const NOW = '2026-11-04T10:00:00.000Z'
const pasted = {
  workItem: 'https://dev.azure.com/acme/fleet/_workitems/edit/1234',
  workItemType: 'Feature' as const,
  title: ' Device archiving ',
  content: '\nBR1 — A Manager can archive a device.\n',
}

describe('parseWorkItemId', () => {
  it.each([
    ['1234', 1234],
    ['#1234', 1234],
    ['  #1234 ', 1234],
    ['https://dev.azure.com/acme/fleet/_workitems/edit/1234', 1234],
    ['https://dev.azure.com/acme/fleet/_workitems/edit/1234/', 1234],
    ['https://dev.azure.com/acme/_workitems/edit/77?src=WorkItemMention', 77],
    ['https://acme.visualstudio.com/Fleet%20App/_workitems/edit/5', 5],
  ])('reads %s as %i', (input, id) => {
    expect(parseWorkItemId(input)).toEqual({ ok: true, workItemId: id })
  })

  it.each(['', 'abc', '#', '0', '12a', 'https://example.com/1234', '-5'])('refuses %j', (input) => {
    expect(parseWorkItemId(input)).toMatchObject({ ok: false })
  })
})

describe('createBacklogCopy', () => {
  it('keeps the ID, a trimmed title and content, the pasted link, and starts at revision 1', () => {
    expect(createBacklogCopy(pasted, NOW)).toEqual({
      ok: true,
      copy: {
        id: 'ado-1234',
        workItemId: 1234,
        workItemType: 'Feature',
        title: 'Device archiving',
        url: 'https://dev.azure.com/acme/fleet/_workitems/edit/1234',
        content: 'BR1 — A Manager can archive a device.',
        revision: 1,
        pastedAt: NOW,
      },
    })
  })

  it('keeps Acceptance Criteria when given, and no link when only the ID was pasted', () => {
    const result = createBacklogCopy({ ...pasted, workItem: '#1234', acceptanceCriteria: ' AC1 — archived. ' }, NOW)
    expect(result.ok && result.copy).toMatchObject({ acceptanceCriteria: 'AC1 — archived.' })
    expect(result.ok && 'url' in result.copy).toBe(false)
  })

  it('treats blank Acceptance Criteria as none', () => {
    const result = createBacklogCopy({ ...pasted, acceptanceCriteria: '  ' }, NOW)
    expect(result.ok && 'acceptanceCriteria' in result.copy).toBe(false)
  })

  it('refuses a bad ID, an empty title, empty content and a type Azure DevOps does not have', () => {
    const result = createBacklogCopy({ workItem: 'x', workItemType: 'Story', title: ' ', content: '' }, NOW)
    expect(result.ok ? [] : result.reasons.map((reason) => reason.code)).toEqual([
      'workItemId',
      'workItemType',
      'title',
      'content',
    ])
  })
})

const LATER = '2026-11-05T09:00:00.000Z'
const created = (): BacklogCopy => {
  const result = createBacklogCopy({ ...pasted, acceptanceCriteria: 'AC1 — archived.' }, NOW)
  if (!result.ok) throw new Error('fixture')
  return result.copy
}

describe('repasteBacklogCopy', () => {
  it('replaces the content, keeps what it replaced and raises the revision', () => {
    const result = repasteBacklogCopy(
      created(),
      { content: 'BR1 — changed.', acceptanceCriteria: 'AC1 — archived.' },
      LATER,
    )
    expect(result).toMatchObject({
      ok: true,
      changed: true,
      copy: {
        content: 'BR1 — changed.',
        previousContent: 'BR1 — A Manager can archive a device.',
        acceptanceCriteria: 'AC1 — archived.',
        previousAcceptanceCriteria: 'AC1 — archived.',
        revision: 2,
        pastedAt: LATER,
      },
    })
  })

  it('counts a change to the Acceptance Criteria alone, including removing them', () => {
    const result = repasteBacklogCopy(created(), { content: pasted.content }, LATER)
    expect(result.ok && result.changed).toBe(true)
    expect(result.ok && 'acceptanceCriteria' in result.copy).toBe(false)
    expect(result.ok && result.copy.revision).toBe(2)
  })

  it('changes nothing when the pasted text is the same after trimming', () => {
    const copy = created()
    const result = repasteBacklogCopy(
      copy,
      { content: ` ${copy.content}\n`, acceptanceCriteria: ' AC1 — archived.' },
      LATER,
    )
    expect(result).toEqual({ ok: true, changed: false, copy })
  })

  it('may rename the Copy without raising the revision', () => {
    const copy = created()
    const result = repasteBacklogCopy(copy, { ...copy, title: ' Archiving ' }, LATER)
    expect(result).toMatchObject({ ok: true, changed: false, copy: { title: 'Archiving', revision: 1 } })
  })

  it('refuses empty content', () => {
    expect(repasteBacklogCopy(created(), { content: ' ' }, LATER)).toMatchObject({ ok: false })
  })
})

describe('backlogCopyChanges', () => {
  const repasted = (content: string, acceptanceCriteria = 'AC1 — archived.') => {
    const copy = { ...created(), content: 'BR1 — one.\nBR2 — two.\nBR3 — three.' }
    const result = repasteBacklogCopy(copy, { content, acceptanceCriteria }, LATER)
    if (!result.ok) throw new Error('fixture')
    return result.copy
  }

  it('lists added and removed lines of the description, with the unchanged ones left out', () => {
    expect(backlogCopyChanges(repasted('BR1 — one.\nBR2 — two, edited.\nBR3 — three.\nBR4 — four.'))).toBe(
      ['Description:', '- BR2 — two.', '+ BR2 — two, edited.', '+ BR4 — four.'].join('\n'),
    )
  })

  it('lists a removed line', () => {
    expect(backlogCopyChanges(repasted('BR1 — one.\nBR3 — three.'))).toBe(['Description:', '- BR2 — two.'].join('\n'))
  })

  it('lists changes to the Acceptance Criteria under their own heading', () => {
    expect(
      backlogCopyChanges(repasted('BR1 — one.\nBR2 — two.\nBR3 — three.', 'AC1 — archived.\nAC2 — restored.')),
    ).toBe(['Acceptance Criteria:', '+ AC2 — restored.'].join('\n'))
  })

  it('says nothing for a Copy that was never re-pasted', () => {
    expect(backlogCopyChanges(created())).toBe('')
  })
})

describe('backlogCopyMarkdown', () => {
  it('heads the readable file with type, ID and title, then the description and Acceptance Criteria', () => {
    const markdown = backlogCopyMarkdown(created())
    expect(markdown).toBe(
      [
        '# Feature #1234: Device archiving',
        '',
        'Azure DevOps: https://dev.azure.com/acme/fleet/_workitems/edit/1234',
        'Revision 1, pasted 2026-11-04T10:00:00.000Z',
        '',
        '## Description',
        '',
        'BR1 — A Manager can archive a device.',
        '',
        '## Acceptance Criteria',
        '',
        'AC1 — archived.',
        '',
      ].join('\n'),
    )
  })
})
