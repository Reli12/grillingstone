import { beforeEach, describe, expect, it } from 'vitest'

import { newDraft } from '#core/draft/draft.ts'
import { defaultPbiTemplate, meta } from '#core/testing/fixtures.ts'

import { resetTestData } from '../../test/server/testBackend.ts'
import { createDraft, getDraft, updateDraft } from './drafts.ts'
import { StaleWrite } from './errors.ts'
import { getGlossary, saveGlossary } from './glossary.ts'
import { safeId } from './paths.ts'
import { createProject } from './projects.ts'
import { getSettings, saveSettings } from './settings.ts'

beforeEach(resetTestData)

const draftIn = async () => {
  const project = await createProject('Ünïcode & Co!', meta.date)
  return createDraft(
    newDraft({
      projectId: project.id,
      workItemType: 'PBI',
      template: defaultPbiTemplate,
      requirement: 'x',
      now: meta.date,
    }),
  )
}

describe('storage', () => {
  it('slugs Project names into safe ids', async () => {
    expect((await createProject('Ünïcode & Co!', meta.date)).id).toMatch(/^unicode-co-[a-z0-9]{5}$/)
    expect((await createProject('!!!', meta.date)).id).toMatch(/^project-/)
    expect(() => safeId('../etc')).toThrow('Invalid id')
  })

  it('serialises Draft updates and skips writes that change nothing', async () => {
    const draft = await draftIn()
    const bump = () => updateDraft(draft.projectId, draft.id, (d) => ({ ...d, references: [...d.references, 'r'] }))
    await Promise.all([bump(), bump(), bump()])
    expect((await getDraft(draft.projectId, draft.id)).references).toEqual(['r', 'r', 'r'])
    const unchanged = await updateDraft(draft.projectId, draft.id, () => null)
    expect(unchanged.updatedAt).toBe((await getDraft(draft.projectId, draft.id)).updatedAt)
  })

  it('refuses a Glossary save made against an older version', async () => {
    const { projectId } = await draftIn()
    const v0 = await getGlossary(projectId)
    await saveGlossary(projectId, 'mine', v0.version)
    await expect(saveGlossary(projectId, 'theirs', v0.version)).rejects.toThrow(StaleWrite)
    expect((await getGlossary(projectId)).markdown).toBe('mine')
  })

  it('cleans Settings on save', async () => {
    expect(await saveSettings({ author: ' ', model: ' ', theme: 'neon' as never })).toMatchObject({
      model: '',
      theme: 'system',
    })
    expect((await getSettings()).author).toBeTruthy()
  })
})
