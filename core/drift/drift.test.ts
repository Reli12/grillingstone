// Tests for Drift: possible Drift from revisions, splitting a field back along the Publish Renderer's structure
// (render → edit in Azure DevOps → split yields the edit), and the Proposal it becomes, Clean or Conflict.
import { describe, expect, it } from 'vitest'

import type { WorkItemView } from '#core/ado/adoTypes.ts'
import type { Draft } from '#core/draft/draftTypes.ts'
import { applyHumanOp } from '#core/draft/humanOps.ts'
import { bringInDrift, detectDrift, mayHaveDrift, splitField } from '#core/drift/drift.ts'
import { decide } from '#core/proposal/triage.ts'
import { publishedSnapshot } from '#core/publish/publishedSnapshot.ts'
import { render } from '#core/publish/publishRenderer.ts'
import { ADO_FIELDS } from '#core/shared/adoFields.ts'
import { acOf, meta, sectionByKey, v1Draft } from '#core/testing/fixtures.ts'

const AC = ADO_FIELDS.acceptanceCriteria
const DESCRIPTION = ADO_FIELDS.description

function itemOf(draft: Draft, rev = 3): WorkItemView {
  const rendered = render(draft)
  return {
    id: 501,
    rev,
    adoType: 'Product Backlog Item',
    workItemType: 'PBI',
    title: rendered.title,
    fields: rendered.fields,
    parentId: 100,
    teamProject: 'P',
    areaPath: 'P',
    iterationPath: 'P',
    state: 'New',
    tags: [],
    url: 'https://dev.azure.com/o/P/_workitems/edit/501',
  }
}

/** The Draft right after Publishing it. */
const published = (draft = v1Draft()): Draft => ({
  ...draft,
  linkedWorkItem: { id: 501, url: 'u', workItemType: 'PBI' },
  publishedSnapshot: publishedSnapshot(draft, itemOf(draft), '2026-11-01'),
})

/** What Azure DevOps holds after someone edited the Published item: `edit` applied to the Draft's content. */
function editedInAdo(draft: Draft, edit: (draft: Draft) => Draft, rev = 5): WorkItemView {
  return itemOf(edit(draft), rev)
}

describe('Drift', () => {
  it('may have Drift only with a newer revision than the last Publish or Drift Check', () => {
    const draft = published()
    expect(mayHaveDrift(draft, 3)).toBe(false)
    expect(mayHaveDrift(draft, 4)).toBe(true)
    expect(mayHaveDrift({ ...draft, driftSeen: { rev: 4, title: '', fields: {} } }, 4)).toBe(false)
    expect(mayHaveDrift(v1Draft(), 9)).toBe(false)
  })

  it('splits a rendered field back into its Sections and Entries', () => {
    const draft = v1Draft()
    const split = splitField(draft, DESCRIPTION, render(draft).fields[DESCRIPTION])
    expect(split.unplaced).toEqual([])
    const scope = split.parts.get(sectionByKey(draft, 'scope').id)
    expect(scope?.entries).toEqual(sectionByKey(draft, 'scope').entries.map(({ title, body }) => ({ title, body })))
    expect(split.parts.get(sectionByKey(draft, 'userStory').id)?.body).toBe(sectionByKey(draft, 'userStory').body)
    const ac = splitField(draft, AC, render(draft).fields[AC]).parts.get(acOf(draft).id)
    expect(ac?.entries).toEqual(acOf(draft).entries.map(({ title, body }) => ({ title, body })))
  })

  it('finds no Drift when only the revision moved (state, assignee…)', () => {
    const draft = published()
    expect(detectDrift(draft, itemOf(draft, 9))).toEqual({ changes: [], notes: [], fields: [] })
  })

  it('turns a reworded criterion into a Clean replaceEntry for the right Entry', () => {
    const draft = published()
    const ac = acOf(draft)
    const item = editedInAdo(draft, (d) =>
      applyHumanOp(d, {
        op: 'editEntry',
        sectionId: ac.id,
        entryId: ac.entries[1].id,
        body: 'Given x\nWhen y\nThen z',
      }),
    )
    const { draft: next, drift } = bringInDrift(draft, item, '2026-11-03')
    expect(drift.fields).toEqual(['Acceptance Criteria'])
    expect(next.proposal?.kind).toBe('drift')
    expect(next.proposal?.changes).toMatchObject([
      {
        kind: 'replaceEntry',
        sectionId: ac.id,
        entryId: ac.entries[1].id,
        body: 'Given x\nWhen y\nThen z',
        conflict: false,
      },
    ])
    expect(next.driftSeen?.rev).toBe(5)
  })

  it('adds an Entry added in Azure DevOps after the one before it, and retitles', () => {
    const draft = published()
    const scope = sectionByKey(draft, 'scope')
    const item = editedInAdo(draft, (d) => {
      const added = applyHumanOp(d, { op: 'addEntry', sectionId: scope.id, title: 'Later', body: 'Bulk restore' })
      return applyHumanOp(added, { op: 'retitle', title: 'Archive devices' })
    })
    const changes = detectDrift(draft, item).changes
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'retitle', title: 'Archive devices' }))
    expect(changes).toContainEqual(
      expect.objectContaining({
        kind: 'addEntry',
        sectionId: scope.id,
        title: 'Later',
        afterEntryId: scope.entries[1].id,
      }),
    )
  })

  it('makes a change to content the human also changed since the Publish a Conflict', () => {
    let draft = published()
    const story = sectionByKey(draft, 'userStory')
    const item = editedInAdo(draft, (d) =>
      applyHumanOp(d, { op: 'editSection', sectionId: story.id, body: 'PO version' }),
    )
    draft = applyHumanOp(draft, { op: 'editSection', sectionId: story.id, body: 'My version' })
    const next = bringInDrift(draft, item, '2026-11-03').draft
    expect(next.proposal?.changes).toMatchObject([
      { kind: 'replaceSection', before: 'My version', after: 'PO version', conflict: true },
    ])
  })

  it('does not undo the human’s own edits to parts Azure DevOps left alone', () => {
    let draft = published()
    const story = sectionByKey(draft, 'userStory')
    const roles = sectionByKey(draft, 'roles')
    const item = editedInAdo(draft, (d) =>
      applyHumanOp(d, { op: 'editSection', sectionId: roles.id, body: 'New roles' }),
    )
    draft = applyHumanOp(draft, { op: 'editSection', sectionId: story.id, body: 'Mine' })
    expect(detectDrift(draft, item).changes).toMatchObject([{ kind: 'replaceSection', sectionId: roles.id }])
  })

  it('reports what it cannot carry: a removed Entry and text under an unknown heading', () => {
    const draft = published()
    const oq = sectionByKey(draft, 'openQuestions')
    const item = editedInAdo(draft, (d) =>
      applyHumanOp(d, { op: 'discardEntry', sectionId: oq.id, entryId: oq.entries[1].id }),
    )
    item.fields[DESCRIPTION] += '\n<h2>Notes from the PO</h2>\n<p>Check with legal.</p>'
    const drift = detectDrift(draft, item)
    expect(drift.notes).toEqual([
      '“2. Should archiving notify the site owner?” (Open Questions / Risks) was removed from Description in Azure DevOps.',
      'Not placed in any Section (Description): ## Notes from the PO\n\nCheck with legal.',
    ])
  })

  it('takes the Azure DevOps version on accept, and does not bring the same Drift in twice', () => {
    const draft = published()
    const story = sectionByKey(draft, 'userStory')
    const item = editedInAdo(draft, (d) =>
      applyHumanOp(d, { op: 'editSection', sectionId: story.id, body: 'PO version' }),
    )
    const brought = bringInDrift(draft, item, '2026-11-03').draft
    const declined = decide(brought, brought.proposal!.changes[0].id, false, meta)
    expect(declined.proposal).toBeNull()
    expect(sectionByKey(declined, 'userStory').body).toBe(story.body)
    expect(detectDrift(declined, item).changes).toEqual([])
    const accepted = decide(brought, brought.proposal!.changes[0].id, true, meta)
    expect(sectionByKey(accepted, 'userStory').body).toBe('PO version')
    expect(accepted.iterationLog.at(-1)?.note).toBe('1 change accepted from Azure DevOps (Drift)')
  })

  it('opens no second Proposal over one that is open', () => {
    const draft = published()
    const story = sectionByKey(draft, 'userStory')
    const item = editedInAdo(draft, (d) => applyHumanOp(d, { op: 'editSection', sectionId: story.id, body: 'PO' }))
    const open = bringInDrift(draft, item, 'now').draft
    const again = bringInDrift(
      open,
      editedInAdo(draft, (d) => d, 9),
      'later',
    ).draft
    expect(again.proposal?.id).toBe(open.proposal?.id)
  })
})
